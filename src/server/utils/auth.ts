import bcrypt from "bcryptjs";
import {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import jwt, {
  type JwtPayload,
  type SignOptions,
} from "jsonwebtoken";

import { db } from "../database.js";
import {
  type AuthenticatedUser,
  type User,
  UserRole,
} from "../../types.js";

const JWT_ISSUER = "transitops";
const JWT_AUDIENCE = "transitops-web";
const PASSWORD_HASH_ROUNDS = 10;

const tokenExpiry = (
  process.env.JWT_EXPIRES_IN ?? "8h"
) as SignOptions["expiresIn"];

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (
    !secret ||
    secret.length < 32 ||
    secret.includes("replace-with")
  ) {
    throw new Error(
      "JWT_SECRET must be configured in .env and contain at least 32 characters.",
    );
  }

  return secret;
}

const JWT_SECRET = resolveJwtSecret();

interface AccessTokenPayload extends JwtPayload {
  email: string;
  role: UserRole;
  token_type: "access";
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export class Security {
  public static hashPassword(password: string): string {
    if (typeof password !== "string" || password.length < 8) {
      throw new Error(
        "Password must contain at least 8 characters.",
      );
    }

    return bcrypt.hashSync(
      password,
      PASSWORD_HASH_ROUNDS,
    );
  }

  public static comparePassword(
    password: string,
    passwordHash: string,
  ): boolean {
    if (
      typeof password !== "string" ||
      typeof passwordHash !== "string" ||
      !passwordHash.trim()
    ) {
      return false;
    }

    try {
      return bcrypt.compareSync(
        password,
        passwordHash,
      );
    } catch {
      return false;
    }
  }

  public static generateToken(user: User): string {
    if (!user.is_active) {
      throw new Error(
        "Cannot generate a token for a disabled user.",
      );
    }

    const payload: Omit<
      AccessTokenPayload,
      keyof JwtPayload
    > = {
      email: user.email,
      role: user.role,
      token_type: "access",
    };

    return jwt.sign(
      payload,
      JWT_SECRET,
      {
        subject: user.id,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: tokenExpiry,
        algorithm: "HS256",
      },
    );
  }

  public static verifyToken(
    token: string,
  ): AccessTokenPayload | null {
    try {
      const decoded = jwt.verify(
        token,
        JWT_SECRET,
        {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          algorithms: ["HS256"],
        },
      );

      if (
        typeof decoded === "string" ||
        !decoded.sub ||
        typeof decoded.email !== "string" ||
        decoded.token_type !== "access" ||
        !Object.values(UserRole).includes(
          decoded.role as UserRole,
        )
      ) {
        return null;
      }

      return decoded as AccessTokenPayload;
    } catch {
      return null;
    }
  }

  public static serializeUser(
    user: User,
  ): AuthenticatedUser {
    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
    };
  }
}

export function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authorizationHeader =
    req.headers.authorization;

  if (!authorizationHeader) {
    res.status(401).json({
      error:
        "Authentication is required. Please log in.",
    });

    return;
  }

  const headerParts = authorizationHeader
    .trim()
    .split(/\s+/);

  if (
    headerParts.length !== 2 ||
    headerParts[0] !== "Bearer" ||
    !headerParts[1]
  ) {
    res.status(401).json({
      error:
        "The authorization header is invalid.",
    });

    return;
  }

  const decoded = Security.verifyToken(
    headerParts[1],
  );

  if (!decoded?.sub) {
    res.status(401).json({
      error:
        "Your session is invalid or has expired. Please log in again.",
    });

    return;
  }

  const user = db.users.find(
    (candidate) => candidate.id === decoded.sub,
  );

  if (!user) {
    res.status(401).json({
      error:
        "The account associated with this session no longer exists.",
    });

    return;
  }

  if (!user.is_active) {
    res.status(403).json({
      error:
        "Your account is disabled. Please contact an administrator.",
    });

    return;
  }

  req.user = user;
  next();
}

export function requireRole(
  allowedRoles: UserRole[],
) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: "Authentication is required.",
      });

      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error:
          "You do not have permission to perform this operation.",
        required_roles: allowedRoles,
        current_role: req.user.role,
      });

      return;
    }

    next();
  };
}