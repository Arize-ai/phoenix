import { ReactNode } from "react";
import { Label } from "react-aria-components";
import { css } from "@emotion/react";

import { Button } from "@phoenix/components/button";
import { Icon, Icons, SelectChevronUpDownIcon } from "@phoenix/components/icon";
import { Popover } from "@phoenix/components/overlay";

import { Select } from "./Select";
import { SelectValue } from "./SelectValue";

type ClearableSelectProps = {
  value: string | null;
  onChange: (value: string | undefined) => void;
  label: string;
  placeholder?: string;
  children: ReactNode;
};

const clearableSelectCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-50);
  & .field-row {
    display: flex;
    flex-direction: row;
    & .ac-select {
      flex: 1 1 auto;
    }
    & .select-button {
      width: 100%;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
    & .clear-button {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      border-left: none;
    }
  }
`;

export const ClearableSelect = ({
  value,
  onChange,
  label,
  placeholder,
  children,
}: ClearableSelectProps) => {
  return (
    <div css={clearableSelectCSS}>
      <Label>{label}</Label>
      <div className="field-row">
        <Select
          value={value}
          onChange={(key) =>
            onChange(typeof key === "string" ? key : undefined)
          }
          placeholder={placeholder}
        >
          <Button className="select-button">
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover>{children}</Popover>
        </Select>
        <Button
          className="clear-button"
          aria-label={`Clear ${label}`}
          isDisabled={value === null}
          leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
          onPress={() => onChange(undefined)}
        />
      </div>
    </div>
  );
};
