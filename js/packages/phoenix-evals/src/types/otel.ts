import { Tracer } from "@opentelemetry/api";

export interface WithTelemetry {
  telemetry?: {
    /**
     * Whether OpenTelemetry is enabled on the call.
     * Defaults to true for visibility into the evals calls.
     * @default true
     */
    isEnabled?: boolean;
    /**
     * The tracer to use for the call.
     * If not provided, the traces will get picked up by the global tracer.
     */
    tracer?: Tracer;
  };
}
