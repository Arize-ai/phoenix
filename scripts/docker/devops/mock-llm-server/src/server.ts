import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { zstdDecompress } from "zlib";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { adminRoutes, adminWebSocket } from "./admin/index.js";
import { getConfig } from "./config.js";
import { createEndpointHandler } from "./middleware/index.js";
import { ALL_PROVIDERS } from "./providers/index.js";
import { registry } from "./registry.js";
import type { TypeSafeModelCard } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

/**
 * Parse JSON bodies, including zstd-compressed ones. The TypeSafe SDK
 * compresses request bodies of 1 KiB or more with zstd by default, and the
 * Express JSON parser only decodes gzip, deflate, and brotli.
 */
const jsonParser = express.json();
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.headers["content-encoding"] !== "zstd") {
    jsonParser(req, res, next);
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("error", next);
  req.on("end", () => {
    zstdDecompress(Buffer.concat(chunks), (err, decoded) => {
      if (err) {
        res.status(400).json({ detail: "Invalid zstd request body" });
        return;
      }
      try {
        req.body = JSON.parse(decoded.toString("utf8"));
      } catch {
        res.status(400).json({ detail: "Invalid JSON request body" });
        return;
      }
      next();
    });
  });
});

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
          `${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
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
  "/dashboard/*splat",
  dashboardRateLimiter,
  (_req: Request, res: Response) => {
    res.sendFile(path.join(dashboardPath, "index.html"));
  }
);

// Traefik's StripPrefix sets this to /mock-llm. Absent when hit directly.
function forwardedPrefix(req: Request): string {
  return (req.get("x-forwarded-prefix") ?? "").replace(/\/$/, "");
}

app.get("/", (req: Request, res: Response) => {
  res.redirect(`${forwardedPrefix(req)}/dashboard/`);
});

app.get("/dashboard", (req: Request, res: Response) => {
  res.redirect(`${forwardedPrefix(req)}/dashboard/`);
});

// =============================================================================
// Health & Models
// =============================================================================

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const TYPESAFE_MODELS: TypeSafeModelCard[] = [
  {
    name: "jev-latest",
    description: "Mock TypeSafe decision model",
    release_date: "2026-10-01",
  },
  {
    name: "jev-preview",
    description: "Mock TypeSafe preview decision model",
    release_date: "2026-10-01",
  },
];

const GEMINI_MODELS = [
  {
    name: "models/gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    description: "Mock Gemini 2.0 Flash model",
    version: "2.0",
    inputTokenLimit: 1048576,
    outputTokenLimit: 8192,
    supportedGenerationMethods: ["generateContent", "streamGenerateContent"],
  },
  {
    name: "models/gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    description: "Mock Gemini 2.5 Pro model",
    version: "2.5",
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    supportedGenerationMethods: ["generateContent", "streamGenerateContent"],
  },
];

app.get("/v1beta/models", (_req: Request, res: Response) => {
  res.json({
    models: GEMINI_MODELS,
  });
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
      {
        id: "gpt-6-luna",
        object: "model",
        created: 1715367049,
        owned_by: "mock-server",
      },
    ],
    // TypeSafe's SDK reads `models` from the same path
    models: TYPESAFE_MODELS,
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
     POST /v1/decisions             (OpenAI Decisions API)
     POST /v1/messages              (Anthropic)
     POST /v1beta/models/*          (Gemini v1beta)
     GET  /v1beta/models            (Gemini v1beta models list)
     POST /v1/models/*              (Gemini v1)
     POST /v1/systemone             (TypeSafe System One)

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
