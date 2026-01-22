import { useEffect, useRef, useState, useCallback } from "react";
import type {
  MetricsSnapshot,
  DetailedMetricsSnapshot,
  ConnectionEvent,
  DynamicConfig,
  WebSocketMessage,
  GlobalConfig,
} from "../types";

interface UseWebSocketReturn {
  connected: boolean;
  metrics: MetricsSnapshot | null;
  detailedMetrics: DetailedMetricsSnapshot | null;
  config: DynamicConfig | null;
  events: ConnectionEvent[];
  updateGlobalConfig: (updates: Partial<GlobalConfig>) => void;
  resetConfig: () => void;
  resetDetailedMetrics: () => void;
  resetRateLimiters: () => void;
}

const MAX_EVENTS = 100;

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountingRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [detailedMetrics, setDetailedMetrics] = useState<DetailedMetricsSnapshot | null>(null);
  const [config, setConfig] = useState<DynamicConfig | null>(null);
  const [events, setEvents] = useState<ConnectionEvent[]>([]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    isUnmountingRef.current = false;

    const connect = () => {
      if (isUnmountingRef.current) return;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onclose = () => {
        setConnected(false);
        // Only reconnect if not intentionally unmounting
        if (!isUnmountingRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, 1000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case "metrics":
              setMetrics(message.data as MetricsSnapshot);
              break;

            case "detailed_metrics":
              setDetailedMetrics(message.data as DetailedMetricsSnapshot);
              break;

            case "config":
              setConfig(message.data as DynamicConfig);
              break;

            case "event":
              setEvents((prev) => {
                const newEvents = [message.data as ConnectionEvent, ...prev];
                return newEvents.slice(0, MAX_EVENTS);
              });
              break;

            case "error":
              console.error("Server error:", message.data);
              break;
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      isUnmountingRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const send = useCallback((message: { type: string; data?: unknown }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const updateGlobalConfig = useCallback(
    (updates: Partial<GlobalConfig>) => {
      send({ type: "update_global_config", data: updates });
    },
    [send]
  );

  const resetConfig = useCallback(() => {
    send({ type: "reset_config" });
  }, [send]);

  const resetDetailedMetrics = useCallback(() => {
    send({ type: "reset_detailed_metrics" });
  }, [send]);

  const resetRateLimiters = useCallback(() => {
    send({ type: "reset_rate_limiters" });
  }, [send]);

  return {
    connected,
    metrics,
    detailedMetrics,
    config,
    events,
    updateGlobalConfig,
    resetConfig,
    resetDetailedMetrics,
    resetRateLimiters,
  };
}
