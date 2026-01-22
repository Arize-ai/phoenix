import { Router, type Request, type Response, type Router as RouterType } from "express";
import { metrics } from "../metrics.js";
import { registry } from "../registry.js";
import { detailedMetrics } from "../detailed-metrics.js";
import { adminWebSocket } from "./websocket.js";
import { getAvailableStrategies, getStrategyDescription } from "../rate-limiting/index.js";
import { ENDPOINT_LABELS, ENDPOINT_IDS } from "../providers/types.js";
import type { EndpointId } from "../providers/types.js";

const router: RouterType = Router();

/**
 * GET /api/health - Admin API health check
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    wsClients: adminWebSocket.getClientCount(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/metrics - Current metrics snapshot
 */
router.get("/metrics", (_req: Request, res: Response) => {
  res.json(metrics.getSnapshot());
});

/**
 * GET /api/metrics/latency/:endpoint - Latency percentiles for endpoint
 */
router.get("/metrics/latency/:endpoint", (req: Request, res: Response) => {
  const endpoint = req.params.endpoint as EndpointId;

  if (!ENDPOINT_LABELS[endpoint]) {
    res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
    return;
  }

  res.json({
    endpoint,
    p50: metrics.getLatencyPercentile(endpoint, 50),
    p90: metrics.getLatencyPercentile(endpoint, 90),
    p99: metrics.getLatencyPercentile(endpoint, 99),
  });
});

/**
 * POST /api/metrics/reset - Reset all metrics
 */
router.post("/metrics/reset", (_req: Request, res: Response) => {
  metrics.reset();
  res.json({ status: "ok", message: "Metrics reset" });
});

/**
 * GET /api/config - Current configuration
 */
router.get("/config", (_req: Request, res: Response) => {
  res.json(registry.getFullConfig());
});

/**
 * PATCH /api/config/global - Update global configuration
 */
router.patch("/config/global", (req: Request, res: Response) => {
  const updates = req.body;

  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "Request body must be an object" });
    return;
  }

  registry.updateGlobalConfig(updates);
  res.json(registry.getFullConfig());
});

/**
 * GET /api/config/endpoints - List all endpoints with their config
 */
router.get("/config/endpoints", (_req: Request, res: Response) => {
  const endpoints: Record<string, { label: string; config: unknown; rateLimiterState: unknown }> = {};

  for (const id of ENDPOINT_IDS) {
    const rateLimiter = registry.getRateLimiter(id);
    endpoints[id] = {
      label: ENDPOINT_LABELS[id],
      config: registry.getEndpointConfig(id),
      rateLimiterState: rateLimiter.getState(),
    };
  }

  res.json(endpoints);
});

/**
 * PATCH /api/config/endpoints/:endpoint - Update endpoint-specific configuration
 */
router.patch("/config/endpoints/:endpoint", (req: Request, res: Response) => {
  const endpoint = req.params.endpoint as EndpointId;
  const updates = req.body;

  if (!ENDPOINT_LABELS[endpoint]) {
    res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
    return;
  }

  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "Request body must be an object" });
    return;
  }

  registry.updateEndpointConfig(endpoint, updates);
  res.json({
    endpoint,
    config: registry.getEndpointConfig(endpoint),
  });
});

/**
 * DELETE /api/config/endpoints/:endpoint - Clear endpoint overrides
 */
router.delete("/config/endpoints/:endpoint", (req: Request, res: Response) => {
  const endpoint = req.params.endpoint as EndpointId;

  if (!ENDPOINT_LABELS[endpoint]) {
    res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
    return;
  }

  registry.clearEndpointOverrides(endpoint);
  res.json({
    endpoint,
    config: registry.getEndpointConfig(endpoint),
    message: "Endpoint overrides cleared, using global config",
  });
});

/**
 * POST /api/config/reset - Reset to initial configuration
 */
router.post("/config/reset", (_req: Request, res: Response) => {
  registry.reset();
  res.json({ status: "ok", message: "Configuration reset", config: registry.getFullConfig() });
});

/**
 * POST /api/rate-limit/reset - Reset all rate limiter states
 */
router.post("/rate-limit/reset", (_req: Request, res: Response) => {
  registry.resetAllRateLimiters();
  res.json({ status: "ok", message: "All rate limiter states reset" });
});

/**
 * POST /api/rate-limit/reset/:endpoint - Reset rate limiter for specific endpoint
 */
router.post("/rate-limit/reset/:endpoint", (req: Request, res: Response) => {
  const endpoint = req.params.endpoint as EndpointId;

  if (!ENDPOINT_LABELS[endpoint]) {
    res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
    return;
  }

  registry.resetRateLimiter(endpoint);
  res.json({ status: "ok", message: `Rate limiter reset for ${endpoint}` });
});

/**
 * GET /api/rate-limit/strategies - List available rate limiting strategies
 */
router.get("/rate-limit/strategies", (_req: Request, res: Response) => {
  const strategies = getAvailableStrategies().map((strategy) => ({
    id: strategy,
    description: getStrategyDescription(strategy),
  }));
  res.json(strategies);
});

// =============================================================================
// Detailed Metrics
// =============================================================================

/**
 * GET /api/detailed-metrics - Full detailed metrics snapshot
 */
router.get("/detailed-metrics", (_req: Request, res: Response) => {
  res.json(detailedMetrics.getSnapshot());
});

/**
 * GET /api/detailed-metrics/export/json - Export detailed metrics as JSON
 */
router.get("/detailed-metrics/export/json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=detailed-metrics.json");
  res.send(detailedMetrics.exportJSON());
});

/**
 * GET /api/detailed-metrics/export/csv - Export time series as CSV
 */
router.get("/detailed-metrics/export/csv", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=detailed-metrics.csv");
  res.send(detailedMetrics.exportCSV());
});

/**
 * POST /api/detailed-metrics/reset - Reset detailed metrics
 */
router.post("/detailed-metrics/reset", (_req: Request, res: Response) => {
  detailedMetrics.reset();
  res.json({ status: "ok", message: "Detailed metrics reset" });
});

/**
 * GET /api/failure-modes - List available failure modes
 */
router.get("/failure-modes", (_req: Request, res: Response) => {
  res.json([
    { id: "timeout", description: "Request hangs indefinitely (client times out)" },
    { id: "server_error", description: "Returns 500 Internal Server Error" },
    { id: "bad_request", description: "Returns 400 Bad Request" },
    { id: "slow_response", description: "Adds 5-10 second delay before response" },
    { id: "connection_reset", description: "Abruptly closes the connection (TCP RST)" },
  ]);
});

export const adminRoutes = router;
