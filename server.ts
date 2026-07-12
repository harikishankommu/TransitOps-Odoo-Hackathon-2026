import "dotenv/config";

import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import path from "node:path";
import { createServer as createViteServer } from "vite";

import { apiRouter } from "./src/server/routers/api.js";

const DEFAULT_PORT = 3000;

function resolvePort(): number {
  const configuredPort = Number(process.env.PORT ?? DEFAULT_PORT);

  return Number.isInteger(configuredPort) && configuredPort > 0
    ? configuredPort
    : DEFAULT_PORT;
}

async function startServer() {
  const app = express();
  const port = resolvePort();
  const isProduction = process.env.NODE_ENV === "production";

  // Avoid exposing Express in response headers.
  app.disable("x-powered-by");

  // Parse JSON requests with a reasonable size limit.
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "TransitOps API",
      environment: isProduction ? "production" : "development",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api", apiRouter);

  // API-specific 404 response.
  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "API endpoint not found.",
    });
  });

  if (!isProduction) {
    console.log("Starting TransitOps in development mode...");

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    console.log("Starting TransitOps in production mode...");

    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));

    // React single-page application fallback.
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Final unhandled error handler.
  app.use(
    (
      error: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      console.error("Unhandled server error:", error);

      res.status(500).json({
        error: "An unexpected server error occurred.",
      });
    },
  );

  const server = app.listen(port, "0.0.0.0", () => {
    console.log("===========================================================");
    console.log(` TransitOps running on: http://localhost:${port}`);
    console.log(` Mode: ${isProduction ? "production" : "development"}`);
    console.log("===========================================================");
  });

  server.on("error", (error) => {
    console.error("TransitOps server failed:", error);
  });
}

startServer().catch((error) => {
  console.error("Failed to start TransitOps:", error);
  process.exitCode = 1;
});