import React from "react";
import { css } from "@emotion/react";

import { Dropdown, Flex, Icon, Icons } from "@arizeai/components";

const SpanColumns = [
  { name: "input", accessorKey: "input.value" },
  { name: "output", accessorKey: "output.value" },
  { name: "start time", accessorKey: "startTime" },
  { name: "status", accessorKey: "status" },
];

export function SpanColumnSelector() {
  return (
    <Dropdown
      menu={<ColumnSelectorMenu />}
      triggerProps={{
        placement: "bottom end",
      }}
    >
      <Flex direction="row" alignItems="center" gap="size-100">
        <Icon svg={<Icons.Column />} />
        Columns
      </Flex>
    </Dropdown>
  );
}

const columCheckboxItemCSS = css`
  padding: var(--ac-global-dimension-static-size-50)
    var(--ac-global-dimension-static-size-100);
  label {
    display: flex;
    align-items: center;
    gap: var(--ac-global-dimension-static-size-100);
  }
`;
function ColumnSelectorMenu() {
  return (
    <ul>
      {SpanColumns.map((column) => (
        <li key={column.accessorKey} css={columCheckboxItemCSS}>
          <label>
            <input type="checkbox" name={column.accessorKey} />
            {column.name}
          </label>
        </li>
      ))}
    </ul>
  );
}
