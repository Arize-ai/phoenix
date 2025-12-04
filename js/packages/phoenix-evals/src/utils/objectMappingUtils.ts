import { ObjectMapping, ValueGetter } from "../types/data";

import { JSONPath } from "jsonpath-plus";

/**
 * Remaps an object by applying field mappings while preserving original data.
 *
 * This function takes your original data object and a mapping configuration,
 * then returns a new object that contains:
 * - All original fields from the input data
 * - Additional/overridden fields based on the mapping
 *
 * The mapping allows you to extract values using:
 * - Simple property names: `"fieldName"`
 * - Dot notation: `"user.profile.name"`
 * - Array access: `"items[0].id"`
 * - JSONPath expressions: `"$.items[*].id"`
 * - Function extractors: `(data) => data.customField`
 *
 * @param data - The input data object to remap
 * @param mapping - The mapping configuration defining how to extract/transform values
 * @returns A new object with original fields plus mapped fields
 *
 * @example
 * **Basic remapping:**
 * ```typescript
 * const data = {
 *   name: "John",
 *   age: 30,
 *   email: "john@example.com",
 * };
 *
 * const mapping: ObjectMapping<typeof data> = {
 *   userName: "name",
 *   userAge: "age",
 * };
 *
 * const result = remapObject(data, mapping);
 * // Result: {
 * //   name: "John",
 * //   age: 30,
 * //   email: "john@example.com",
 * //   userName: "John",      // Added from mapping
 * //   userAge: 30,            // Added from mapping
 * // }
 * ```
 *
 * @example
 * **Nested property extraction:**
 * ```typescript
 * const data = {
 *   user: {
 *     profile: {
 *       firstName: "John",
 *       lastName: "Doe",
 *     },
 *     email: "john@example.com",
 *   },
 * };
 *
 * const mapping: ObjectMapping<typeof data> = {
 *   firstName: "user.profile.firstName",
 *   lastName: "user.profile.lastName",
 *   email: "user.email",
 * };
 *
 * const result = remapObject(data, mapping);
 * // Result includes original data plus:
 * // {
 * //   firstName: "John",
 * //   lastName: "Doe",
 * //   email: "john@example.com",
 * // }
 * ```
 *
 * @example
 * **Array element access:**
 * ```typescript
 * const data = {
 *   items: [
 *     { id: 1, name: "Apple" },
 *     { id: 2, name: "Banana" },
 *   ],
 * };
 *
 * const mapping: ObjectMapping<typeof data> = {
 *   firstItemId: "items[0].id",
 *   firstItemName: "items[0].name",
 * };
 *
 * const result = remapObject(data, mapping);
 * // Result includes:
 * // {
 * //   firstItemId: 1,
 * //   firstItemName: "Apple",
 * // }
 * ```
 *
 * @example
 * **Function-based transformation:**
 * ```typescript
 * const data = {
 *   firstName: "John",
 *   lastName: "Doe",
 *   scores: [85, 92, 78],
 * };
 *
 * const mapping: ObjectMapping<typeof data> = {
 *   fullName: (data) => `${data.firstName} ${data.lastName}`,
 *   averageScore: (data) =>
 *     data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
 * };
 *
 * const result = remapObject(data, mapping);
 * // Result includes:
 * // {
 * //   fullName: "John Doe",
 * //   averageScore: 85,
 * // }
 * ```
 *
 * @example
 * **Field override:**
 * ```typescript
 * const data = {
 *   name: "John",
 *   status: "inactive",
 * };
 *
 * const mapping: ObjectMapping<typeof data> = {
 *   // Override existing field
 *   status: (data) => data.name === "John" ? "active" : "inactive",
 *   // Add new field
 *   displayName: (data) => `User: ${data.name}`,
 * };
 *
 * const result = remapObject(data, mapping);
 * // Result:
 * // {
 * //   name: "John",
 * //   status: "active",        // Overridden
 * //   displayName: "User: John", // Added
 * // }
 * ```
 *
 * @example
 * **Real-world evaluator usage:**
 * ```typescript
 * // Your data structure
 * const example = {
 *   question: "What is AI?",
 *   context: "AI is artificial intelligence...",
 *   answer: "AI stands for artificial intelligence",
 * };
 *
 * // Evaluator expects: { input, reference, output }
 * const mapping: ObjectMapping<typeof example> = {
 *   input: "question",
 *   reference: "context",
 *   output: "answer",
 * };
 *
 * const remapped = remapObject(example, mapping);
 * // Now remapped has: { question, context, answer, input, reference, output }
 * // The evaluator can access input, reference, and output fields
 * ```
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
 * Extracts a value from a data object using a value getter.
 *
 * This internal function handles the actual extraction logic, supporting both
 * string-based paths (including JSONPath) and function-based extractors.
 *
 * @param data - The data object to extract from
 * @param valueGetter - The value getter (string path or function)
 * @returns The extracted value
 *
 * @internal
 */
function getMappedObjectValue<DataType extends Record<string, unknown>>(
  data: DataType,
  valueGetter: ValueGetter<DataType>
): DataType[keyof DataType] {
  return typeof valueGetter === "function"
    ? valueGetter(data)
    : JSONPath({ path: valueGetter, json: data, wrap: false });
}
