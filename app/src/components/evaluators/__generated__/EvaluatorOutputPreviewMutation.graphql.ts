/**
 * @generated SignedSource<<cd3bbf19f05cfcb7475c71fc537b6ee7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type EvaluatorPreviewsInput = {
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  previews: ReadonlyArray<EvaluatorPreviewItemInput>;
};
export type EvaluatorPreviewItemInput = {
  context: any;
  evaluator: EvaluatorPreviewInput;
  inputMapping?: EvaluatorInputMappingInput;
};
export type EvaluatorPreviewInput = {
  builtInEvaluatorId?: string | null;
  inlineLlmEvaluator?: InlineLLMEvaluatorInput | null;
};
export type InlineLLMEvaluatorInput = {
  description?: string | null;
  outputConfig: CategoricalAnnotationConfigInput;
  promptVersion: ChatPromptVersionInput;
};
export type ChatPromptVersionInput = {
  customProviderId?: string | null;
  description?: string | null;
  invocationParameters?: any;
  modelName: string;
  modelProvider: ModelProvider;
  responseFormat?: ResponseFormatInput | null;
  template: PromptChatTemplateInput;
  templateFormat: PromptTemplateFormat;
  tools?: ReadonlyArray<ToolDefinitionInput>;
};
export type PromptChatTemplateInput = {
  messages: ReadonlyArray<PromptMessageInput>;
};
export type PromptMessageInput = {
  content: ReadonlyArray<ContentPartInput>;
  role: string;
};
export type ContentPartInput = {
  text?: TextContentValueInput | null;
  toolCall?: ToolCallContentValueInput | null;
  toolResult?: ToolResultContentValueInput | null;
};
export type TextContentValueInput = {
  text: string;
};
export type ToolCallContentValueInput = {
  toolCall: ToolCallFunctionInput;
  toolCallId: string;
};
export type ToolCallFunctionInput = {
  arguments: string;
  name: string;
  type?: string | null;
};
export type ToolResultContentValueInput = {
  result: any;
  toolCallId: string;
};
export type ToolDefinitionInput = {
  definition: any;
};
export type ResponseFormatInput = {
  definition: any;
};
export type CategoricalAnnotationConfigInput = {
  description?: string | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  values: ReadonlyArray<CategoricalAnnotationConfigValueInput>;
};
export type CategoricalAnnotationConfigValueInput = {
  label: string;
  score?: number | null;
};
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
};
export type GenerativeCredentialInput = {
  envVarName: string;
  value: any;
};
export type EvaluatorOutputPreviewMutation$variables = {
  input: EvaluatorPreviewsInput;
};
export type EvaluatorOutputPreviewMutation$data = {
  readonly evaluatorPreviews: {
    readonly results: ReadonlyArray<{
      readonly __typename: "EvaluationError";
      readonly evaluatorName: string;
      readonly message: string;
    } | {
      readonly __typename: "EvaluationSuccess";
      readonly annotation: {
        readonly explanation: string | null;
        readonly id: string;
        readonly label: string | null;
        readonly name: string;
        readonly score: number | null;
      };
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    }>;
  };
};
export type EvaluatorOutputPreviewMutation = {
  response: EvaluatorOutputPreviewMutation$data;
  variables: EvaluatorOutputPreviewMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "EvaluatorPreviewsPayload",
    "kind": "LinkedField",
    "name": "evaluatorPreviews",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": null,
        "kind": "LinkedField",
        "name": "results",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunAnnotation",
                "kind": "LinkedField",
                "name": "annotation",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "explanation",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "label",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "score",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "name",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "id",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "EvaluationSuccess",
            "abstractKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "evaluatorName",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "message",
                "storageKey": null
              }
            ],
            "type": "EvaluationError",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorOutputPreviewMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EvaluatorOutputPreviewMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "bca0dc6c97c2c512cd5c3dae382629fd",
    "id": null,
    "metadata": {},
    "name": "EvaluatorOutputPreviewMutation",
    "operationKind": "mutation",
    "text": "mutation EvaluatorOutputPreviewMutation(\n  $input: EvaluatorPreviewsInput!\n) {\n  evaluatorPreviews(input: $input) {\n    results {\n      __typename\n      ... on EvaluationSuccess {\n        annotation {\n          explanation\n          label\n          score\n          name\n          id\n        }\n      }\n      ... on EvaluationError {\n        evaluatorName\n        message\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "93dcc88dc60666fd6d3844c6d33f86cc";

export default node;
