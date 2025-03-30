import { useMemo } from "react";
import { useLocale } from "react-aria-components";

import { getLocaleDateFormatPattern } from "@phoenix/utils/timeFormatUtils";

/**
 * Returns the date format pattern for the current locale
 * @returns The date format pattern for the current locale
 */
export function useLocalTimeFormatPattern() {
  const { locale } = useLocale();
  const pattern = useMemo(() => getLocaleDateFormatPattern(locale), [locale]);
  return pattern;
}
