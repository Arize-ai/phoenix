import React, { startTransition, useCallback, useMemo } from "react";
import debounce from "lodash/debounce";
import { css } from "@emotion/react";

import { Input, TextField } from "@phoenix/components";

type ProjectsSearchProps = {
  onChange: (value: string) => void;
};

const DEBOUNCE_TIME = 200;

export function ProjectsSearch({
  onChange: propsOnChange,
}: ProjectsSearchProps) {
  const debouncedOnChange = useMemo(
    () =>
      debounce((v: string) => {
        startTransition(() => {
          propsOnChange(v);
        });
      }, DEBOUNCE_TIME),
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
        flex-basis: 100%;
      `}
      aria-label="Search projects by name"
      name="filter"
      type="search"
      onChange={onChange}
    >
      <Input placeholder="Search projects by name" />
    </TextField>
  );
}
