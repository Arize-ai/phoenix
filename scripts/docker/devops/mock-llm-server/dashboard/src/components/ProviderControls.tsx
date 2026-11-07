import type { DynamicConfig, EndpointConfig, ProviderGroup } from "../types";
import {
  STREAMING_ENDPOINT_IDS,
  STREAM_ONLY_ENDPOINT_IDS,
  TOOL_CALL_ENDPOINT_IDS,
} from "../types";
import { effectiveEndpointConfig } from "../utils/endpointConfig";
import { FailureModes } from "./FailureModes";
import { LatencyControls } from "./LatencyControls";
import { RateLimitFields, RateLimitToggle } from "./RateLimitPanel";

interface Props {
  provider: ProviderGroup;
  config: DynamicConfig | null;
  onUpdate: (updates: Partial<EndpointConfig>) => void;
}

export function ProviderControls({ provider, config, onUpdate }: Props) {
  const representative = provider.endpoints[0];
  const values = config
    ? effectiveEndpointConfig(config, representative)
    : null;
  const showResponseDelay = provider.endpoints.some(
    (id) => !STREAM_ONLY_ENDPOINT_IDS.has(id)
  );
  const showStreaming = provider.endpoints.some((id) =>
    STREAMING_ENDPOINT_IDS.has(id)
  );
  const showToolCalls = provider.endpoints.some((id) =>
    TOOL_CALL_ENDPOINT_IDS.has(id)
  );

  return (
    <section className="h-full rounded border border-gray-700 bg-gray-800 px-2.5 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium text-gray-200">{provider.label}</h2>
        <RateLimitToggle values={values} onUpdate={onUpdate} />
      </div>
      {values?.rateLimit.enabled && (
        <div className="mb-1.5">
          <RateLimitFields
            rateLimit={values.rateLimit}
            onUpdate={(rateLimit) => onUpdate({ rateLimit })}
          />
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-4">
        <LatencyControls
          values={values}
          showResponseDelay={showResponseDelay}
          showStreaming={showStreaming}
          showToolCalls={showToolCalls}
          onUpdate={onUpdate}
        />
        <FailureModes
          values={values}
          showStreaming={showStreaming}
          onUpdate={onUpdate}
        />
      </div>
    </section>
  );
}
