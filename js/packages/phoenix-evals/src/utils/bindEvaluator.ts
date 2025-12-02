import { EvaluatorBase } from "../core/EvaluatorBase";
import { ObjectMapping } from "../types/data";

/**
 * Context for binding an evaluator with input mapping configuration.
 *
 * This type defines the structure for binding an evaluator to a specific data shape
 * by mapping the evaluator's expected input fields to the actual data structure.
 *
 * @example
 * ```typescript
 * // Map evaluator fields to your data structure
 * const context: BindingContext<MyDataType> = {
 *   inputMapping: {
 *     input: "userQuery",        // Maps "input" to "userQuery" field
 *     reference: "context",      // Maps "reference" to "context" field
 *     output: "modelResponse",   // Maps "output" to "modelResponse" field
 *   },
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Using nested property access
 * const context: BindingContext<ApiResponse> = {
 *   inputMapping: {
 *     input: "request.body.query",
 *     reference: "request.body.context",
 *     output: "response.data.text",
 *   },
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Using function-based mapping for transformations
 * const context: BindingContext<RawData> = {
 *   inputMapping: {
 *     input: "question",
 *     reference: (data) => data.context.join("\n"),  // Transform array to string
 *     output: "answer",
 *   },
 * };
 * ```
 *
 * @typeParam RecordType - The type of the data record that will be evaluated
 */
export type BindingContext<RecordType extends Record<string, unknown>> = {
  /**
   * Mapping of evaluator input fields to data source fields.
   *
   * The keys represent the field names expected by the evaluator (e.g., "input", "output", "reference"),
   * and the values specify how to extract those fields from your data structure.
   *
   * Supports:
   * - Simple property names: `"fieldName"`
   * - Dot notation: `"user.profile.name"`
   * - Array access: `"items[0].id"`
   * - JSONPath expressions: `"$.items[*].id"`
   * - Function extractors: `(data) => data.customField.toUpperCase()`
   */
  inputMapping: ObjectMapping<RecordType>;
};

/**
 * Binds an evaluator to a specific data structure using input mapping.
 *
 * This function creates a new evaluator instance that automatically transforms
 * your data structure to match what the evaluator expects. This is particularly
 * useful when your data schema doesn't match the evaluator's expected input format.
 *
 * @param evaluator - The evaluator to bind (e.g., a hallucination evaluator)
 * @param context - The binding context containing the input mapping configuration
 * @returns A new evaluator instance with the input mapping applied
 *
 * @example
 * **Basic usage with simple field mapping:**
 * ```typescript
 * import { bindEvaluator, createHallucinationEvaluator } from "@arizeai/phoenix-evals";
 * import { openai } from "@ai-sdk/openai";
 *
 * type MyData = {
 *   question: string;
 *   context: string;
 *   answer: string;
 * };
 *
 * const evaluator = bindEvaluator<MyData>(
 *   createHallucinationEvaluator({ model: openai("gpt-4") }),
 *   {
 *     inputMapping: {
 *       input: "question",      // Evaluator expects "input", map from "question"
 *       reference: "context",   // Evaluator expects "reference", map from "context"
 *       output: "answer",        // Evaluator expects "output", map from "answer"
 *     },
 *   }
 * );
 *
 * // Now you can evaluate with your data structure
 * const result = await evaluator.evaluate({
 *   question: "What is AI?",
 *   context: "AI is artificial intelligence...",
 *   answer: "AI stands for artificial intelligence",
 * });
 * ```
 *
 * @example
 * **Using nested property access:**
 * ```typescript
 * type ApiResponse = {
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
 * const evaluator = bindEvaluator<ApiResponse>(
 *   createHallucinationEvaluator({ model: openai("gpt-4") }),
 *   {
 *     inputMapping: {
 *       input: "request.body.query",
 *       reference: "request.body.context",
 *       output: "response.data.text",
 *     },
 *   }
 * );
 * ```
 *
 * @example
 * **Using function-based mapping for data transformation:**
 * ```typescript
 * type RawData = {
 *   question: string;
 *   contexts: string[];  // Array of context strings
 *   answer: string;
 * };
 *
 * const evaluator = bindEvaluator<RawData>(
 *   createHallucinationEvaluator({ model: openai("gpt-4") }),
 *   {
 *     inputMapping: {
 *       input: "question",
 *       // Transform array to single string
 *       reference: (data) => data.contexts.join("\n\n"),
 *       output: "answer",
 *     },
 *   }
 * );
 * ```
 *
 * @example
 * **Using JSONPath for complex queries:**
 * ```typescript
 * type ComplexData = {
 *   conversation: {
 *     messages: Array<{ role: string; content: string }>;
 *   };
 *   metadata: {
 *     sources: string[];
 *   };
 * };
 *
 * const evaluator = bindEvaluator<ComplexData>(
 *   createHallucinationEvaluator({ model: openai("gpt-4") }),
 *   {
 *     inputMapping: {
 *       // Extract last user message
 *       input: "$.conversation.messages[?(@.role=='user')].content[-1]",
 *       // Extract all sources
 *       reference: "$.metadata.sources[*]",
 *       // Extract last assistant message
 *       output: "$.conversation.messages[?(@.role=='assistant')].content[-1]",
 *     },
 *   }
 * );
 * ```
 *
 * @example
 * **Binding multiple evaluators with different mappings:**
 * ```typescript
 * type EvaluationData = {
 *   userQuery: string;
 *   systemContext: string;
 *   modelOutput: string;
 *   expectedOutput?: string;
 * };
 *
 * // Hallucination evaluator
 * const hallucinationEvaluator = bindEvaluator<EvaluationData>(
 *   createHallucinationEvaluator({ model: openai("gpt-4") }),
 *   {
 *     inputMapping: {
 *       input: "userQuery",
 *       reference: "systemContext",
 *       output: "modelOutput",
 *     },
 *   }
 * );
 *
 * // Document relevancy evaluator (if it exists)
 * const relevancyEvaluator = bindEvaluator<EvaluationData>(
 *   createDocumentRelevanceEvaluator({ model: openai("gpt-4") }),
 *   {
 *     inputMapping: {
 *       query: "userQuery",
 *       document: "systemContext",
 *       output: "modelOutput",
 *     },
 *   }
 * );
 * ```
 */
export function bindEvaluator<RecordType extends Record<string, unknown>>(
  evaluator: EvaluatorBase<RecordType>,
  context: BindingContext<RecordType>
): EvaluatorBase<RecordType> {
  let boundEvaluator: EvaluatorBase<RecordType> = evaluator;
  if (context.inputMapping) {
    boundEvaluator = boundEvaluator.bindInputMapping(context.inputMapping);
  }
  return boundEvaluator;
}
