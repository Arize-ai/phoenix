/**
 * The value of an input mapping. It can be a JSON path or a function that returns the value
 */
export type ValueGetter<DataType extends Record<string, unknown>> =
  | string
  | ((data: DataType) => DataType[keyof DataType]);

/**
 * A mapping of data keys to the corresponding value in the data passed in.
 * The value can be a string, or a function that returns the value.
 * @example
 * const mapping: ObjectMapping<{ a: string, b: number }> = {
 *   a: "a",
 *   b: (data) => data.b,
 * };
 */
export type ObjectMapping<DataType extends Record<string, unknown>> = Record<
  string,
  ValueGetter<DataType>
>;
