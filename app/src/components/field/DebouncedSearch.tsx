import { startTransition, useCallback, useMemo } from "react";
import debounce from "lodash/debounce";

import {
  Input,
  SearchField,
  SearchFieldProps,
  SearchIcon,
} from "@phoenix/components";

export interface DebouncedSearchProps extends SearchFieldProps {
  onChange: (value: string) => void;
  /**
   * Text to show the user before typing
   * This is required as search fields without it look too empty
   */
  placeholder: string;
  /**
   * The number of milliseconds before the search change fires
   * @default 200
   */
  debounceMs?: number;
}

/**
 * A simple search field with an icon that has built-in debouncing
 */
export function DebouncedSearch({
  onChange: propsOnChange,
  debounceMs = 200,
  placeholder,
}: DebouncedSearchProps) {
  const debouncedOnChange = useMemo(
    () =>
      debounce((v: string) => {
        startTransition(() => {
          propsOnChange(v);
        });
      }, debounceMs),
    [propsOnChange, debounceMs]
  );
  const onChange = useCallback(
    (v: string) => {
      debouncedOnChange(v);
    },
    [debouncedOnChange]
  );

  return (
    <SearchField onChange={onChange}>
      <SearchIcon />
      <Input placeholder={placeholder} />
    </SearchField>
  );
}
