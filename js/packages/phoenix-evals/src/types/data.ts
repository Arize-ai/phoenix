/**
 * The value of an input mapping. It can be a path, property name, or a function that returns the value
 * - String: Can be a simple property name (e.g., "name"), dot notation (e.g., "user.name", "address.street", "items[0].id"), or a JSONPath expression (e.g., "$.user.name", "$.items[*].id")
 * - Function: A function that receives the data object and returns the desired value
 */
export type ValueGetter<DataType extends Record<string, unknown>> =
  | string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ((data: DataType) => any);

/**
 * A mapping of data keys to the corresponding value in the data passed in.
 * The value can be a string (property name, dot notation, or JSONPath), or a function that returns the value.
 * @example
 * ```typescript
 * const mapping: ObjectMapping<{ user: { name: string }, items: Array<{ id: number }> }> = {
 *   // Simple property access
 *   userName: "user.name",
 *   // Dot notation with array access
 *   firstItemId: "items[0].id",
 *   // JSONPath expressions (for complex queries)
 *   allItemIds: "$.items[*].id",
 *   // Function-based extraction
 *   customValue: (data) => data.user.name.toUpperCase(),
 * };
 * ```
 */
export type ObjectMapping<DataType extends Record<string, unknown>> = Record<
  string,
  ValueGetter<DataType>
>;
