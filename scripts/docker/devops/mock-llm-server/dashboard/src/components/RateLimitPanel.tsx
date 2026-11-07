import type { EndpointConfig, RateLimitStrategy } from "../types";
import { RATE_LIMIT_STRATEGIES } from "../types";
import { SliderControl } from "./SliderControl";
import { Toggle } from "./Toggle";

interface Props {
  values: EndpointConfig | null;
  onUpdate: (updates: Partial<EndpointConfig>) => void;
}

export function RateLimitToggle({ values, onUpdate }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-gray-500">Rate Limiting</span>
      {values && (
        <Toggle
          enabled={values.rateLimit.enabled}
          onChange={(enabled) =>
            onUpdate({ rateLimit: { ...values.rateLimit, enabled } })
          }
          color="yellow"
        />
      )}
    </div>
  );
}

export function RateLimitFields({
  rateLimit,
  onUpdate,
}: {
  rateLimit: EndpointConfig["rateLimit"];
  onUpdate: (rateLimit: EndpointConfig["rateLimit"]) => void;
}) {
  const update = (updates: Partial<EndpointConfig["rateLimit"]>) => {
    onUpdate({ ...rateLimit, ...updates });
  };

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-end gap-x-3">
      <select
        value={rateLimit.strategy}
        onChange={(event) =>
          update({ strategy: event.target.value as RateLimitStrategy })
        }
        className="mb-0.5 rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 text-[11px]"
      >
        {RATE_LIMIT_STRATEGIES.map((strategy) => (
          <option key={strategy.id} value={strategy.id}>
            {strategy.label}
          </option>
        ))}
      </select>

      {(rateLimit.strategy === "fixed-window" ||
        rateLimit.strategy === "sliding-window") && (
        <>
          <SliderControl
            label="Max Requests"
            value={rateLimit.maxRequests}
            min={1}
            max={100}
            step={1}
            accentColor="yellow"
            onChange={(value) => update({ maxRequests: value })}
          />
          <SliderControl
            label="Window (seconds)"
            value={rateLimit.windowMs / 1000}
            min={1}
            max={300}
            step={1}
            unit="s"
            accentColor="yellow"
            onChange={(value) => update({ windowMs: value * 1000 })}
          />
        </>
      )}

      {(rateLimit.strategy === "token-bucket" ||
        rateLimit.strategy === "leaky-bucket") && (
        <>
          <SliderControl
            label="Bucket Capacity"
            value={rateLimit.bucketCapacity}
            min={1}
            max={50}
            step={1}
            accentColor="yellow"
            onChange={(value) => update({ bucketCapacity: value })}
          />
          <SliderControl
            label="Refill Rate"
            value={rateLimit.refillRate}
            min={0.1}
            max={10}
            step={0.1}
            unit="/s"
            accentColor="yellow"
            onChange={(value) => update({ refillRate: value })}
          />
        </>
      )}

      {rateLimit.strategy === "after-n" && (
        <div className="col-span-2">
          <SliderControl
            label="Fail After N Requests"
            value={rateLimit.failAfterN}
            min={1}
            max={50}
            step={1}
            accentColor="yellow"
            onChange={(value) => update({ failAfterN: value })}
          />
        </div>
      )}

      {rateLimit.strategy === "random" && (
        <div className="col-span-2">
          <SliderControl
            label="Failure Probability"
            value={rateLimit.failProbability}
            min={0}
            max={1}
            step={0.05}
            unit="%"
            displayMultiplier={100}
            accentColor="yellow"
            onChange={(value) => update({ failProbability: value })}
          />
        </div>
      )}
    </div>
  );
}
