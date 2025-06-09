import { startTransition, useCallback, useMemo } from "react";
import debounce from "lodash/debounce";
import { css } from "@emotion/react";

import { Input, TextField } from "@phoenix/components";

type DatasetsSearchProps = {
  onChange: (value: string) => void;
  value?: string;
};

const DEBOUNCE_MS = 200;

export function DatasetsSearch({
  onChange: propsOnChange,
  value,
}: DatasetsSearchProps) {
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
      debouncedOnChange(v);
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
      onChange={onChange}
      defaultValue={value}
    >
      <Input placeholder="Search datasets by name" />
    </TextField>
  );
}
