import { useEffect, useState } from "react";
import { Input } from "react-aria-components";

import { useDebouncedChange } from "@phoenix/hooks/useDebouncedChange";

import type { SearchFieldProps } from "./SearchField";
import { SearchField, SearchIcon } from "./SearchField";

export interface DebouncedSearchProps extends Omit<
  SearchFieldProps,
  "onChange"
> {
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
  /**
   * The aria-label for the search field. Since there is no label, we need to provide one.
   */
  "aria-label": string;
}

/**
 * A search field whose visible value updates immediately while expensive
 * consumers receive changes after a debounce. A controlled `value` can also
 * update the field programmatically without delaying typing.
 */
export function DebouncedSearch({
  onChange: propsOnChange,
  debounceMs = 200,
  placeholder,
  value,
  defaultValue,
  children,
  ...props
}: DebouncedSearchProps) {
  const debouncedOnChange = useDebouncedChange({
    onChange: propsOnChange,
    debounceMs,
  });
  const [inputValue, setInputValue] = useState(
    () => value ?? defaultValue ?? ""
  );
  const [previousValue, setPreviousValue] = useState(value);

  if (value !== previousValue) {
    setPreviousValue(value);
    setInputValue(value ?? "");
  }

  useEffect(() => {
    debouncedOnChange.cancel();
    return () => debouncedOnChange.cancel();
  }, [debouncedOnChange, value]);

  return (
    <SearchField
      value={inputValue}
      onChange={(nextValue) => {
        setInputValue(nextValue);
        debouncedOnChange(nextValue);
      }}
      {...props}
    >
      {(renderProps) => (
        <>
          <SearchIcon />
          <Input placeholder={placeholder} />
          {typeof children === "function" ? children(renderProps) : children}
        </>
      )}
    </SearchField>
  );
}
