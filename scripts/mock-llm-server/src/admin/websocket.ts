import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { metrics, type ConnectionEvent } from "../metrics.js";
import { detailedMetrics, type DetailedMetricsSnapshot } from "../detailed-metrics.js";
import { registry, type DynamicConfig } from "../registry.js";
import type { EndpointId } from "../providers/types.js";

interface WebSocketMessage {
  type: "metrics" | "detailed_metrics" | "event" | "config" | "error";
  data: unknown;
}

export class AdminWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private metricsInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Attach WebSocket server to existing HTTP server
   */
  attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      this.clients.add(ws);

      // Send initial state
      this.send(ws, { type: "metrics", data: metrics.getSnapshot() });
      this.send(ws, { type: "detailed_metrics", data: detailedMetrics.getSnapshot() });
      this.send(ws, { type: "config", data: registry.getFullConfig() });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch {
          this.send(ws, { type: "error", data: "Invalid message format" });
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.clients.delete(ws);
      });
    });

    // Subscribe to metrics events
    metrics.on("event", (event: ConnectionEvent) => {
      this.broadcast({ type: "event", data: event });
    });

    // Subscribe to config changes
    registry.on("config_change", (config: DynamicConfig) => {
      this.broadcast({ type: "config", data: config });
    });

    // Subscribe to detailed metrics ticks (1 second interval)
    detailedMetrics.on("tick", (snapshot: DetailedMetricsSnapshot) => {
      if (this.clients.size > 0) {
        this.broadcast({ type: "detailed_metrics", data: snapshot });
      }
    });

    // Send metrics snapshot every 100ms for smooth updates
    this.metricsInterval = setInterval(() => {
      if (this.clients.size > 0) {
        this.broadcast({ type: "metrics", data: metrics.getSnapshot() });
      }
    }, 100);

  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(ws: WebSocket, message: { type: string; data?: unknown }): void {
    switch (message.type) {
      case "get_metrics":
        this.send(ws, { type: "metrics", data: metrics.getSnapshot() });
        break;

      case "get_config":
        this.send(ws, { type: "config", data: registry.getFullConfig() });
        break;

      case "update_global_config":
        if (message.data && typeof message.data === "object") {
          registry.updateGlobalConfig(message.data as Record<string, unknown>);
        }
        break;

      case "update_endpoint_config":
        if (message.data && typeof message.data === "object") {
          const { endpoint, config } = message.data as { endpoint: string; config: Record<string, unknown> };
          if (endpoint && config) {
            registry.updateEndpointConfig(endpoint as EndpointId, config);
          }
        }
        break;

      case "reset_config":
        registry.reset();
        break;

      case "reset_metrics":
        metrics.reset();
        break;

      case "reset_rate_limiters":
        registry.resetAllRateLimiters();
        break;

      case "reset_detailed_metrics":
        detailedMetrics.reset();
        this.send(ws, { type: "detailed_metrics", data: detailedMetrics.getSnapshot() });
        break;

      case "get_detailed_metrics":
        this.send(ws, { type: "detailed_metrics", data: detailedMetrics.getSnapshot() });
        break;

      default:
        this.send(ws, { type: "error", data: `Unknown message type: ${message.type}` });
    }
  }

  /**
   * Send message to a single client
   */
  private send(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: WebSocketMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

// Singleton instance
export const adminWebSocket = new AdminWebSocketServer();
