import type { DynamicConfig, GlobalConfig, RateLimitStrategy } from "../types";
import { RATE_LIMIT_STRATEGIES } from "../types";
import { SliderControl } from "./SliderControl";
import { Toggle } from "./Toggle";

interface Props {
  config: DynamicConfig | null;
  onUpdate: (updates: Partial<GlobalConfig>) => void;
}

export function RateLimitPanel({ config, onUpdate }: Props) {
  if (!config) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
        <h2 className="mb-2 text-sm font-medium">Rate Limiting</h2>
        <div className="text-xs text-gray-500">Waiting for config...</div>
      </div>
    );
  }

  const { global } = config;
  const rateLimit = global.rateLimit;

  const updateRateLimit = (updates: Partial<typeof rateLimit>) => {
    onUpdate({
      rateLimit: { ...rateLimit, ...updates },
    } as Partial<GlobalConfig>);
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">Rate Limiting</h2>
        <Toggle
          enabled={rateLimit.enabled}
          onChange={(enabled) => updateRateLimit({ enabled })}
          color="yellow"
        />
      </div>

      {rateLimit.enabled && (
        <div className="space-y-2">
          <select
            value={rateLimit.strategy}
            onChange={(e) =>
              updateRateLimit({ strategy: e.target.value as RateLimitStrategy })
            }
            className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs"
          >
            {RATE_LIMIT_STRATEGIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
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
                onChange={(value) => updateRateLimit({ maxRequests: value })}
              />
              <SliderControl
                label="Window (seconds)"
                value={rateLimit.windowMs / 1000}
                min={1}
                max={300}
                step={1}
                unit="s"
                accentColor="yellow"
                onChange={(value) =>
                  updateRateLimit({ windowMs: value * 1000 })
                }
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
                onChange={(value) => updateRateLimit({ bucketCapacity: value })}
              />
              <SliderControl
                label="Refill Rate"
                value={rateLimit.refillRate}
                min={0.1}
                max={10}
                step={0.1}
                unit="/s"
                accentColor="yellow"
                onChange={(value) => updateRateLimit({ refillRate: value })}
              />
            </>
          )}

          {rateLimit.strategy === "after-n" && (
            <SliderControl
              label="Fail After N Requests"
              value={rateLimit.failAfterN}
              min={1}
              max={50}
              step={1}
              accentColor="yellow"
              onChange={(value) => updateRateLimit({ failAfterN: value })}
            />
          )}

          {rateLimit.strategy === "random" && (
            <SliderControl
              label="Failure Probability"
              value={rateLimit.failProbability}
              min={0}
              max={1}
              step={0.05}
              unit="%"
              displayMultiplier={100}
              accentColor="yellow"
              onChange={(value) => updateRateLimit({ failProbability: value })}
            />
          )}
        </div>
      )}
    </div>
  );
}
