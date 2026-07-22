// resolution-mode lets this CJS-resolved module type-import the ESM-only AI
// SDK packages; the values are only ever loaded via dynamic import() below.
import type {
  OpenTelemetry as OpenTelemetryIntegration,
  OpenTelemetryOptions,
} from "@ai-sdk/otel" with { "resolution-mode": "import" };
import { trace, type Tracer } from "@arizeai/phoenix-otel";
import type { Telemetry } from "ai" with { "resolution-mode": "import" };

const AI_SDK_TRACER_NAME = "@arizeai/phoenix-client/ai-sdk";

type GlobalWithAiSdkTelemetry = typeof globalThis & {
  AI_SDK_TELEMETRY_INTEGRATIONS?: Telemetry[];
};

type OpenTelemetryConstructor = new (
  options?: OpenTelemetryOptions
) => OpenTelemetryIntegration;

let registrationPromise: Promise<boolean> | undefined;

/**
 * Creates a tracer that follows whichever provider Phoenix client currently
 * owns as the global provider.
 */
function createLazyTracer(name: string): Tracer {
  return {
    startSpan(spanName, options, context) {
      return trace.getTracer(name).startSpan(spanName, options, context);
    },
    startActiveSpan(...args: unknown[]) {
      const tracer = trace.getTracer(name);
      return Reflect.apply(tracer.startActiveSpan, tracer, args);
    },
  } as Tracer;
}

function getGlobalTelemetryIntegrations(): Telemetry[] {
  return (
    (globalThis as GlobalWithAiSdkTelemetry).AI_SDK_TELEMETRY_INTEGRATIONS ?? []
  );
}

function isOpenTelemetryIntegration({
  integration,
  OpenTelemetry,
}: {
  integration: Telemetry;
  OpenTelemetry: OpenTelemetryConstructor;
}): boolean {
  if (integration instanceof OpenTelemetry) {
    return true;
  }
  const constructorName = integration.constructor?.name;
  return (
    constructorName === "OpenTelemetry" ||
    constructorName === "LegacyOpenTelemetry"
  );
}

async function registerAiSdkTelemetryIntegration(): Promise<boolean> {
  let registerTelemetry: (...integrations: Telemetry[]) => void;
  let OpenTelemetry: OpenTelemetryConstructor;
  try {
    const [loadedAiModule, loadedOpenTelemetryModule] = await Promise.all([
      import("ai"),
      import("@ai-sdk/otel"),
    ]);
    registerTelemetry = loadedAiModule.registerTelemetry;
    OpenTelemetry = loadedOpenTelemetryModule.OpenTelemetry;
  } catch {
    // AI SDK support is optional for the core client package.
    return false;
  }

  const hasOpenTelemetryIntegration = getGlobalTelemetryIntegrations().some(
    (integration) => isOpenTelemetryIntegration({ integration, OpenTelemetry })
  );
  if (hasOpenTelemetryIntegration) {
    return true;
  }

  const integration: OpenTelemetryIntegration = new OpenTelemetry({
    tracer: createLazyTracer(AI_SDK_TRACER_NAME),
    usage: true,
    providerMetadata: true,
    embedding: true,
    reranking: true,
    runtimeContext: true,
    // Request headers can contain credentials and must never be exported by
    // Phoenix client implicitly.
    headers: false,
    toolChoice: true,
    schema: true,
  });
  registerTelemetry(integration);
  return true;
}

/**
 * Ensures AI SDK v7 spans created by Phoenix client experiment tasks follow
 * the client-owned global tracer provider.
 *
 * This intentionally remains internal: AI SDK telemetry registration is
 * process-global and cannot be undone when an experiment finishes.
 */
export function registerAiSdkTelemetry(): Promise<boolean> {
  registrationPromise ??= registerAiSdkTelemetryIntegration();
  return registrationPromise;
}

/** @internal Test-only reset for the module-level idempotency guard. */
export function resetAiSdkTelemetryRegistrationForTesting(): void {
  registrationPromise = undefined;
}
