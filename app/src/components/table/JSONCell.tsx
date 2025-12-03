import { CellContext } from "@tanstack/react-table";

import { JSONText } from "@phoenix/components/code/JSONText";

import { LargeTextWrap } from "./LargeTextWrap";

export type JSONCellProps<TData extends object, TValue> = CellContext<
  TData,
  TValue
> & {
  collapseSingleKey?: boolean;
  height?: number;
};

export function JSONCell<TData extends object, TValue>({
  getValue,
  collapseSingleKey,
  height = 300,
}: JSONCellProps<TData, TValue>) {
  const value = getValue();
  return (
    <LargeTextWrap height={height}>
      <JSONText json={value} space={2} collapseSingleKey={collapseSingleKey} />
    </LargeTextWrap>
  );
}
