import { ObjectMapping, ValueGetter } from "../types/data";

import { JSONPath } from "jsonpath-plus";

/**
 * A function that takes an object and a mapping and returns the re-mapped object.
 * The mapping is partial - you only need to specify the fields you want in the output.
 * @param data The input data object
 * @param mapping A partial mapping of output keys to value extractors
 * @returns A new object with only the mapped fields
 */
export function remapObject<DataType extends Record<string, unknown>>(
  data: DataType,
  mapping: ObjectMapping<DataType>
): DataType {
  return {
    ...data,
    ...Object.fromEntries(
      Object.entries(mapping).map(([key, value]) => [
        key,
        getMappedObjectValue(data, value),
      ])
    ),
  };
}

/**
 * A function that takes an object and a value and returns the value
 */
function getMappedObjectValue<DataType extends Record<string, unknown>>(
  data: DataType,
  valueGetter: ValueGetter<DataType>
): DataType[keyof DataType] {
  return typeof valueGetter === "function"
    ? valueGetter(data)
    : JSONPath({ path: valueGetter, json: data, wrap: false });
}
