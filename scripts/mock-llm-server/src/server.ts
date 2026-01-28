import express, { type Express } from "express";
import type { Request, Response } from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

import { getConfig } from "./config.js";
import { registry } from "./registry.js";
import { adminRoutes, adminWebSocket } from "./admin/index.js";
import { createEndpointHandler } from "./middleware/index.js";
import { ALL_PROVIDERS } from "./providers/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();
app.use(express.json());

const envConfig = getConfig();

// Initialize registry from environment config
registry.initFromEnv(envConfig);

// Register all providers
for (const provider of ALL_PROVIDERS) {
  registry.registerProvider(provider);
}

// =============================================================================
// Middleware
// =============================================================================

// Logging middleware (disabled by default since dashboard shows all requests)
const VERBOSE_LOGGING = process.env.VERBOSE === "true";
if (VERBOSE_LOGGING) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (
        !req.path.startsWith("/api") &&
        !req.path.startsWith("/dashboard") &&
        req.path !== "/ws"
      ) {
        console.log(
          `${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
        );
      }
    });
    next();
  });
}

// =============================================================================
// Dashboard
// =============================================================================

// Simple rate limiter for dashboard routes (prevents abuse of file system access)
const dashboardRateLimiter = (() => {
  const requests = new Map<string, number[]>();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100; // 100 requests per minute per IP

  return (req: Request, res: Response, next: () => void) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const timestamps = requests.get(ip) || [];

    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter((t) => now - t < windowMs);

    if (validTimestamps.length >= maxRequests) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    validTimestamps.push(now);
    requests.set(ip, validTimestamps);
    next();
  };
})();

// Serve static dashboard files in production
const dashboardPath = path.join(__dirname, "../dashboard/dist");
app.use("/dashboard", dashboardRateLimiter, express.static(dashboardPath));

// Serve index.html for all dashboard routes (SPA support)
app.get(
  "/dashboard/*",
  dashboardRateLimiter,
  (_req: Request, res: Response) => {
    res.sendFile(path.join(dashboardPath, "index.html"));
  },
);

// Redirect root /dashboard to /dashboard/
app.get("/dashboard", (_req: Request, res: Response) => {
  res.redirect("/dashboard/");
});

// =============================================================================
// Health & Models
// =============================================================================

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/v1/models", (_req: Request, res: Response) => {
  res.json({
    object: "list",
    data: [
      {
        id: "gpt-4o",
        object: "model",
        created: 1715367049,
        owned_by: "mock-server",
      },
      {
        id: "gpt-4o-mini",
        object: "model",
        created: 1715367049,
        owned_by: "mock-server",
      },
      {
        id: "gpt-4-turbo",
        object: "model",
        created: 1715367049,
        owned_by: "mock-server",
      },
      {
        id: "gpt-3.5-turbo",
        object: "model",
        created: 1715367049,
        owned_by: "mock-server",
      },
    ],
  });
});

// =============================================================================
// Admin Routes
// =============================================================================

app.use("/api", adminRoutes);

// =============================================================================
// LLM Provider Endpoints
// =============================================================================

// Register all provider routes automatically
for (const provider of ALL_PROVIDERS) {
  const handler = createEndpointHandler(provider);

  if (provider.method === "POST") {
    app.post(provider.routePath, handler);
  } else if (provider.method === "GET") {
    app.get(provider.routePath, handler);
  }
}

// =============================================================================
// Server Lifecycle
// =============================================================================

let httpServer: ReturnType<typeof createServer> | null = null;

export function startServer(): Promise<void> {
  return new Promise((resolve) => {
    httpServer = createServer(app);

    // Attach WebSocket server
    adminWebSocket.attach(httpServer);

    httpServer.listen(envConfig.port, () => {
      console.log(`
🚀 Mock LLM Server running at http://localhost:${envConfig.port}

   Dashboard: http://localhost:${envConfig.port}/dashboard

   Endpoints:
     POST /v1/chat/completions      (OpenAI)
     POST /v1/responses             (OpenAI Responses API)
     POST /v1/messages              (Anthropic)
     POST /v1beta/models/*          (Gemini v1beta)
     POST /v1/models/*              (Gemini v1)

   Set VERBOSE=true for request logging
`);
      resolve();
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    adminWebSocket.close();
    if (httpServer) {
      httpServer.close(() => {
        httpServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Legacy exports for test compatibility
export function resetRateLimitState(): void {
  registry.resetAllRateLimiters();
}

export { app };

// Start server if run directly
const isMain =
  process.argv[1]?.endsWith("server.ts") ||
  process.argv[1]?.endsWith("server.js");
if (isMain) {
  startServer();
}
