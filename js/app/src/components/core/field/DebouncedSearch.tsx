import { Input } from "react-aria-components";

import { useDebouncedChange } from "@phoenix/hooks/useDebouncedChange";

import type { SearchFieldProps } from "./SearchField";
import { SearchField, SearchIcon } from "./SearchField";

export interface DebouncedSearchProps extends Omit<
  SearchFieldProps,
  "value" | "onChange"
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
 * A simple search field with an icon that has built-in debouncing
 */
export function DebouncedSearch({
  onChange: propsOnChange,
  debounceMs = 200,
  placeholder,
  ...props
}: DebouncedSearchProps) {
  const onChange = useDebouncedChange({
    onChange: propsOnChange,
    debounceMs,
  });

  return (
    <SearchField onChange={onChange} {...props}>
      <SearchIcon />
      <Input placeholder={placeholder} />
    </SearchField>
  );
}
