import { ObjectMapping, ValueGetter } from "../types/data";

/**
 * A function that takes an object and a mapping and returns the re-mapped object
 */
export function remapInput<DataType extends Record<string, unknown>>(
  data: DataType,
  mapping: ObjectMapping<DataType>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(mapping).map(([key, value]) => [
      key,
      getMappedInputValue(data, value),
    ])
  );
}

/**
 * A function that takes an object and a value and returns the value
 */
function getMappedInputValue<DataType extends Record<string, unknown>>(
  data: DataType,
  valueGetter: ValueGetter<DataType>
): unknown {
  return typeof valueGetter === "function" ? valueGetter(data) : valueGetter;
}
