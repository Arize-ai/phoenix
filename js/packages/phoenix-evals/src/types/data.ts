/**
 * A value extractor that can retrieve data from an object using various methods.
 *
 * This type supports multiple ways to extract values from your data structure:
 * - **String paths**: Simple property names, dot notation, or JSONPath expressions
 * - **Function extractors**: Custom transformation functions
 *
 * @example
 * **Simple property access:**
 * ```typescript
 * const getter: ValueGetter<{ name: string }> = "name";
 * ```
 *
 * @example
 * **Dot notation for nested properties:**
 * ```typescript
 * const getter: ValueGetter<{ user: { profile: { name: string } } }> = "user.profile.name";
 * ```
 *
 * @example
 * **Array element access:**
 * ```typescript
 * const getter: ValueGetter<{ items: string[] }> = "items[0]";
 * ```
 *
 * @example
 * **JSONPath expression:**
 * ```typescript
 * const getter: ValueGetter<{ items: Array<{ id: number }> }> = "$.items[*].id";
 * ```
 *
 * @example
 * **Function-based extraction:**
 * ```typescript
 * const getter: ValueGetter<{ firstName: string; lastName: string }> =
 *   (data) => `${data.firstName} ${data.lastName}`;
 * ```
 *
 * @example
 * **Complex transformation:**
 * ```typescript
 * const getter: ValueGetter<{ scores: number[] }> =
 *   (data) => data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
 * ```
 *
 * @typeParam DataType - The type of the data object to extract values from
 */
export type ValueGetter<DataType extends Record<string, unknown>> =
  | string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ((data: DataType) => any);

/**
 * A mapping configuration that transforms data from one structure to another.
 *
 * This type defines how to map fields from your data structure to the fields
 * expected by an evaluator or other component. The mapping is flexible and
 * supports multiple extraction methods.
 *
 * **Key Features:**
 * - Preserves original data fields
 * - Adds/overrides fields with mapped values
 * - Supports nested property access
 * - Supports array element access
 * - Supports JSONPath expressions for complex queries
 * - Supports function-based transformations
 *
 * @example
 * **Basic field mapping:**
 * ```typescript
 * type MyData = {
 *   userQuery: string;
 *   context: string;
 *   response: string;
 * };
 *
 * const mapping: ObjectMapping<MyData> = {
 *   input: "userQuery",      // Map "input" to "userQuery"
 *   reference: "context",    // Map "reference" to "context"
 *   output: "response",       // Map "output" to "response"
 * };
 * ```
 *
 * @example
 * **Nested property mapping:**
 * ```typescript
 * type ApiData = {
 *   request: {
 *     body: {
 *       query: string;
 *       context: string;
 *     };
 *   };
 *   response: {
 *     data: {
 *       text: string;
 *     };
 *   };
 * };
 *
 * const mapping: ObjectMapping<ApiData> = {
 *   input: "request.body.query",
 *   reference: "request.body.context",
 *   output: "response.data.text",
 * };
 * ```
 *
 * @example
 * **Array element access:**
 * ```typescript
 * type DataWithArrays = {
 *   messages: Array<{ role: string; content: string }>;
 *   sources: string[];
 * };
 *
 * const mapping: ObjectMapping<DataWithArrays> = {
 *   firstMessage: "messages[0].content",
 *   lastSource: "sources[-1]",  // Last element
 *   allRoles: "$.messages[*].role",  // JSONPath for all roles
 * };
 * ```
 *
 * @example
 * **Function-based transformations:**
 * ```typescript
 * type RawData = {
 *   firstName: string;
 *   lastName: string;
 *   contexts: string[];
 *   scores: number[];
 * };
 *
 * const mapping: ObjectMapping<RawData> = {
 *   // Combine fields
 *   fullName: (data) => `${data.firstName} ${data.lastName}`,
 *   // Transform array to string
 *   contextText: (data) => data.contexts.join("\n\n"),
 *   // Calculate derived value
 *   averageScore: (data) =>
 *     data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
 *   // Conditional logic
 *   status: (data) => data.scores.length > 0 ? "active" : "inactive",
 * };
 * ```
 *
 * @example
 * **Mixed mapping types:**
 * ```typescript
 * type ComplexData = {
 *   user: {
 *     name: string;
 *     email: string;
 *   };
 *   items: Array<{ id: number; name: string }>;
 *   metadata: {
 *     tags: string[];
 *   };
 * };
 *
 * const mapping: ObjectMapping<ComplexData> = {
 *   // Simple dot notation
 *   userName: "user.name",
 *   // Array access
 *   firstItemId: "items[0].id",
 *   // JSONPath for complex query
 *   allItemNames: "$.items[*].name",
 *   // Function for transformation
 *   formattedTags: (data) => data.metadata.tags.map(t => `#${t}`).join(" "),
 * };
 * ```
 *
 * @example
 * **Real-world evaluator binding:**
 * ```typescript
 * import { bindEvaluator, createHallucinationEvaluator } from "@arizeai/phoenix-evals";
 *
 * type QAData = {
 *   question: string;
 *   context: string;
 *   answer: string;
 * };
 *
 * const mapping: ObjectMapping<QAData> = {
 *   input: "question",      // Evaluator expects "input"
 *   reference: "context",   // Evaluator expects "reference"
 *   output: "answer",       // Evaluator expects "output"
 * };
 *
 * const evaluator = bindEvaluator(
 *   createHallucinationEvaluator({ model: openai("gpt-4") }),
 *   { inputMapping: mapping }
 * );
 * ```
 *
 * @typeParam DataType - The type of the data object being mapped
 */
export type ObjectMapping<DataType extends Record<string, unknown>> = Record<
  string,
  ValueGetter<DataType>
>;
