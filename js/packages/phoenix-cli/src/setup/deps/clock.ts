/**
 * The time capability: reading the clock and waiting on it. Injectable so
 * trace-verification polling tests run instantly against a scripted clock.
 */

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export function createSystemClock(): Clock {
  return {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
