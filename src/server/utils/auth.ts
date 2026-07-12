import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { db } from "../database.js";
import { User, UserRole } from "../../types.js";

const JWT_SECRET = process.env.JWT_SECRET || "transitops_super_secret_master_key_9981!";
const TOKEN_EXPIRY = "24h";

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export class Security {
  public static hashPassword(password: string): string {
    return bcrypt.hashSync(password, 8);
  }

  public static comparePassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
  }

  public static generateToken(user: User): string {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  }

  public static verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return null;
    }
  }
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access token is missing or invalid. Please log in again." });
  }

  const token = authHeader.split(" ")[1];
  const decoded = Security.verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }

  const user = db.users.find(u => u.id === decoded.id);

  if (!user) {
    return res.status(401).json({ error: "User account no longer exists." });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: "Your account is disabled. Please contact an administrator." });
  }

  req.user = user;
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access Denied. This operation requires one of these roles: ${allowedRoles.join(", ")}. Your current role is: ${req.user.role}`
      });
    }

    next();
  };
}
