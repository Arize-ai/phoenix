import type { DynamicConfig, GlobalConfig, RateLimitStrategy } from "../types";
import { RATE_LIMIT_STRATEGIES } from "../types";
import { Toggle } from "./Toggle";

interface Props {
  config: DynamicConfig | null;
  onUpdate: (updates: Partial<GlobalConfig>) => void;
}

export function RateLimitPanel({ config, onUpdate }: Props) {
  if (!config) {
    return (
      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
        <h2 className="text-sm font-medium mb-2">Rate Limiting</h2>
        <div className="text-gray-500 text-xs">Waiting for config...</div>
      </div>
    );
  }

  const { global } = config;
  const rateLimit = global.rateLimit;

  const updateRateLimit = (updates: Partial<typeof rateLimit>) => {
    onUpdate({ rateLimit: { ...rateLimit, ...updates } } as Partial<GlobalConfig>);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium">Rate Limiting</h2>
        <Toggle enabled={rateLimit.enabled} onChange={(enabled) => updateRateLimit({ enabled })} color="yellow" />
      </div>

      {rateLimit.enabled && (
        <div className="space-y-2">
          <select
            value={rateLimit.strategy}
            onChange={(e) => updateRateLimit({ strategy: e.target.value as RateLimitStrategy })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
          >
            {RATE_LIMIT_STRATEGIES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          {(rateLimit.strategy === "fixed-window" || rateLimit.strategy === "sliding-window") && (
            <>
              <SliderControl label="Max Requests" value={rateLimit.maxRequests} min={1} max={100} step={1} onChange={(value) => updateRateLimit({ maxRequests: value })} />
              <SliderControl label="Window (seconds)" value={rateLimit.windowMs / 1000} min={1} max={300} step={1} unit="s" onChange={(value) => updateRateLimit({ windowMs: value * 1000 })} />
            </>
          )}

          {(rateLimit.strategy === "token-bucket" || rateLimit.strategy === "leaky-bucket") && (
            <>
              <SliderControl label="Bucket Capacity" value={rateLimit.bucketCapacity} min={1} max={50} step={1} onChange={(value) => updateRateLimit({ bucketCapacity: value })} />
              <SliderControl label="Refill Rate" value={rateLimit.refillRate} min={0.1} max={10} step={0.1} unit="/s" onChange={(value) => updateRateLimit({ refillRate: value })} />
            </>
          )}

          {rateLimit.strategy === "after-n" && (
            <SliderControl label="Fail After N Requests" value={rateLimit.failAfterN} min={1} max={50} step={1} onChange={(value) => updateRateLimit({ failAfterN: value })} />
          )}

          {rateLimit.strategy === "random" && (
            <SliderControl label="Failure Probability" value={Math.round(rateLimit.failProbability * 100)} min={0} max={100} step={5} unit="%" onChange={(value) => updateRateLimit({ failProbability: value / 100 })} />
          )}
        </div>
      )}
    </div>
  );
}

function SliderControl({ label, value, min, max, step, unit = "", onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (value: number) => void; }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-500">{label}</span>
        <span className="font-mono text-gray-300">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded appearance-none cursor-pointer accent-yellow-500" />
    </div>
  );
}
