import { useCallback, useMemo } from "react";

import {
  getLocalTimeZone,
  getSupportedTimezones,
} from "@phoenix/utils/timeUtils";

/**
 * A react hook that returns a memoized value of the supported timezones
 * @returns The supported timezones
 */
export function useSupportedTimeZones(): string[] {
  return useMemo(() => getSupportedTimezones(), []);
}

export function useLocalTimeZone(): string {
  return useMemo(() => getLocalTimeZone(), []);
}

export type TimeZoneInfo = {
  localTimeZone: string;
  supportedTimezones: string[];
  isSupportedTimeZone: (timezone: string) => boolean;
};

/**
 * A react hook that returns a memoized value of the timezone information
 * @returns The timezone information
 */
export function useTimeZone(): TimeZoneInfo {
  const supportedTimezones = useSupportedTimeZones();
  const isSupportedTimeZone = useCallback(
    (timezone: string) => supportedTimezones.includes(timezone),
    [supportedTimezones]
  );
  return {
    localTimeZone: getLocalTimeZone(),
    supportedTimezones,
    isSupportedTimeZone,
  };
}
