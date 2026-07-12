import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./src/server/routers/api.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable JSON request body parsing
  app.use(express.json());

  // Mount API routes
  app.use("/api", apiRouter);

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "TransitOps API Engine", timestamp: new Date().toISOString() });
  });

  // Vite development middleware vs Static Production files
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite dev middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static frontend assets
    app.use(express.static(distPath));
    
    // SPA Fallback: Send index.html for any other routing path
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`===========================================================`);
    console.log(` TransitOps running on: http://localhost:${PORT}`);
    console.log(` Development app is live in the preview pane.`);
    console.log(`===========================================================`);
  });
}

startServer().catch(err => {
  console.error("Failed to start full-stack server:", err);
});
