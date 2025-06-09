import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import debounce from "lodash/debounce";
import { css } from "@emotion/react";

import { Input, TextField } from "@phoenix/components";

type DatasetsSearchProps = {
  onChange: (value: string) => void;
  value: string;
};

const DEBOUNCE_MS = 200;

export function DatasetsSearch({
  onChange: propsOnChange,
  value,
}: DatasetsSearchProps) {
  // Internal state for immediate UI updates
  const [internalValue, setInternalValue] = useState(value);

  // Sync internal state when external value changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const debouncedOnChange = useMemo(
    () =>
      debounce((v: string) => {
        startTransition(() => {
          propsOnChange(v);
        });
      }, DEBOUNCE_MS),
    [propsOnChange]
  );

  const onChange = useCallback(
    (v: string) => {
      setInternalValue(v); // Update internal state immediately
      debouncedOnChange(v); // Debounce the parent update
    },
    [debouncedOnChange]
  );

  return (
    <TextField
      size="S"
      css={css`
        width: 100%;
      `}
      aria-label="Search datasets by name"
      name="filter"
      type="search"
      value={internalValue}
      onChange={onChange}
    >
      <Input placeholder="Search datasets by name" />
    </TextField>
  );
}
