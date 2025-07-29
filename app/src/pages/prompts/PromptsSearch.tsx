import { startTransition, useCallback, useMemo } from "react";
import debounce from "lodash/debounce";
import { css } from "@emotion/react";

import { Input, TextField } from "@phoenix/components";

type PromptsSearchProps = {
  onChange: (value: string) => void;
};

const DEBOUNCE_MS = 200;

export function PromptsSearch({ onChange: propsOnChange }: PromptsSearchProps) {
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
      size="M"
      css={css`
        flex-basis: 100%;
      `}
      aria-label="Search prompts by name"
      name="filter"
      type="search"
      onChange={onChange}
    >
      <Input placeholder="Search prompts by name" />
    </TextField>
  );
}
