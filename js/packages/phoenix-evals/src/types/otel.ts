import { Tracer } from "@opentelemetry/api";

export interface WithTelemetry {
  telemetry?: {
    isEnabled?: boolean;
    tracer?: Tracer;
  };
}
