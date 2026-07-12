import "dotenv/config";

import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createServer as createViteServer } from "vite";

import { apiRouter } from "./src/server/routers/api.js";

const DEFAULT_PORT = 3000;
const DEFAULT_API_WINDOW_MS = 60_000;
const DEFAULT_API_MAX_REQUESTS = 240;
const DEFAULT_AUTH_WINDOW_MS = 15 * 60_000;
const DEFAULT_AUTH_MAX_REQUESTS = 10;

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolvePort(): number {
  return parsePositiveInteger(process.env.PORT, DEFAULT_PORT);
}

function resolveTrustProxy(): boolean | number | string {
  const configuredValue = process.env.TRUST_PROXY?.trim();

  if (!configuredValue || configuredValue === "false") {
    return false;
  }

  if (configuredValue === "true") {
    return true;
  }

  const numericValue = Number.parseInt(configuredValue, 10);
  return Number.isInteger(numericValue) && numericValue >= 0
    ? numericValue
    : configuredValue;
}

function parseAllowedOrigins(): Set<string> {
  return new Set(
    (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
}

function createRateLimiter(options: {
  windowMs: number;
  maximumRequests: number;
  message: string;
}): RequestHandler {
  const records = new Map<string, RateLimitRecord>();
  let lastCleanup = Date.now();

  return (req, res, next): void => {
    const now = Date.now();

    if (now - lastCleanup > options.windowMs) {
      for (const [key, record] of records) {
        if (record.resetAt <= now) {
          records.delete(key);
        }
      }
      lastCleanup = now;
    }

    const clientKey = req.ip || req.socket.remoteAddress || "unknown";
    const existingRecord = records.get(clientKey);
    const record =
      !existingRecord || existingRecord.resetAt <= now
        ? { count: 0, resetAt: now + options.windowMs }
        : existingRecord;

    record.count += 1;
    records.set(clientKey, record);

    const remaining = Math.max(0, options.maximumRequests - record.count);
    const resetSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));

    res.setHeader("RateLimit-Limit", String(options.maximumRequests));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (record.count > options.maximumRequests) {
      res.setHeader("Retry-After", String(resetSeconds));
      res.status(429).json({ error: options.message });
      return;
    }

    next();
  };
}

function createCorsMiddleware(
  isProduction: boolean,
): RequestHandler {
  const allowedOrigins = parseAllowedOrigins();
  const localDevelopmentOrigin =
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

  return (req, res, next): void => {
    const origin = req.headers.origin?.replace(/\/$/, "");

    if (!origin) {
      next();
      return;
    }

    const host = req.get("host");
    const currentOrigin = host ? `${req.protocol}://${host}` : "";
    const isSameOrigin = origin === currentOrigin;
    const isConfiguredOrigin = allowedOrigins.has(origin);
    const isAllowedLocalOrigin =
      !isProduction && localDevelopmentOrigin.test(origin);

    if (!isSameOrigin && !isConfiguredOrigin && !isAllowedLocalOrigin) {
      res.status(403).json({ error: "This request origin is not allowed." });
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization,Content-Type,X-Requested-With",
    );
    res.setHeader("Access-Control-Max-Age", "600");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}

function securityHeaders(
  isProduction: boolean,
): RequestHandler {
  return (req, res, next): void => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );

    if (isProduction) {
      res.setHeader(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob:",
          "connect-src 'self'",
        ].join("; "),
      );

      if (req.secure) {
        res.setHeader(
          "Strict-Transport-Security",
          "max-age=31536000; includeSubDomains",
        );
      }
    }

    next();
  };
}

async function startServer(): Promise<void> {
  const app = express();
  const port = resolvePort();
  const isProduction = process.env.NODE_ENV === "production";

  app.disable("x-powered-by");
  app.set("trust proxy", resolveTrustProxy());

  app.use((req, res, next) => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);
    next();
  });

  app.use(securityHeaders(isProduction));
  app.use(createCorsMiddleware(isProduction));
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "64kb" }));

  app.get("/api/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: "ok",
      service: "TransitOps API",
      environment: isProduction ? "production" : "development",
      timestamp: new Date().toISOString(),
    });
  });

  const apiLimiter = createRateLimiter({
    windowMs: parsePositiveInteger(
      process.env.API_RATE_LIMIT_WINDOW_MS,
      DEFAULT_API_WINDOW_MS,
    ),
    maximumRequests: parsePositiveInteger(
      process.env.API_RATE_LIMIT_MAX,
      DEFAULT_API_MAX_REQUESTS,
    ),
    message: "Too many API requests. Please try again shortly.",
  });

  const authLimiter = createRateLimiter({
    windowMs: parsePositiveInteger(
      process.env.AUTH_RATE_LIMIT_WINDOW_MS,
      DEFAULT_AUTH_WINDOW_MS,
    ),
    maximumRequests: parsePositiveInteger(
      process.env.AUTH_RATE_LIMIT_MAX,
      DEFAULT_AUTH_MAX_REQUESTS,
    ),
    message: "Too many authentication attempts. Please wait and try again.",
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api", apiRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });

  if (!isProduction) {
    console.log("Starting TransitOps in development mode...");

    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    console.log("Starting TransitOps in production mode...");

    const distPath = path.join(process.cwd(), "dist");
    const indexPath = path.join(distPath, "index.html");

    if (!fs.existsSync(indexPath)) {
      throw new Error(
        "Production frontend build was not found. Run npm run build before npm start.",
      );
    }

    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader(
              "Cache-Control",
              "public, max-age=31536000, immutable",
            );
          } else {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      }),
    );

    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexPath);
    });
  }

  app.use(
    (
      error: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      const parsedError = error as {
        status?: number;
        type?: string;
        message?: string;
      };

      if (
        parsedError.status === 400 &&
        parsedError.type === "entity.parse.failed"
      ) {
        res.status(400).json({ error: "The request body contains invalid JSON." });
        return;
      }

      console.error("Unhandled server error:", {
        request_id: res.locals.requestId,
        error,
      });

      res.status(500).json({
        error: "An unexpected server error occurred.",
        request_id: res.locals.requestId,
      });
    },
  );

  const server = app.listen(port, "0.0.0.0", () => {
    console.log("===========================================================");
    console.log(` TransitOps running on: http://localhost:${port}`);
    console.log(` Mode: ${isProduction ? "production" : "development"}`);
    console.log("===========================================================");
  });

  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  server.keepAliveTimeout = 5_000;

  server.on("error", (error) => {
    console.error("TransitOps server failed:", error);
  });

  let isShuttingDown = false;

  const shutdown = (signal: string): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`${signal} received. Closing TransitOps safely...`);

    const forcedShutdownTimer = setTimeout(() => {
      console.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10_000);
    forcedShutdownTimer.unref();

    server.close((error) => {
      clearTimeout(forcedShutdownTimer);

      if (error) {
        console.error("TransitOps shutdown failed:", error);
        process.exit(1);
      }

      console.log("TransitOps stopped successfully.");
      process.exit(0);
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch((error) => {
  console.error("Failed to start TransitOps:", error);
  process.exitCode = 1;
});
