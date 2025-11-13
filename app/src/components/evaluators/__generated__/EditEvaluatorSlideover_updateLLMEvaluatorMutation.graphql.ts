/**
 * @generated SignedSource<<2df7345dba4a9138dd8c5ba9b92d85d8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type UpdateLLMEvaluatorInput = {
  description?: string | null;
  evaluatorId: string;
  name: string;
  outputConfig: CategoricalAnnotationConfigInput;
  promptVersion: ChatPromptVersionInput;
};
export type ChatPromptVersionInput = {
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
export type EditEvaluatorSlideover_updateLLMEvaluatorMutation$variables = {
  input: UpdateLLMEvaluatorInput;
};
export type EditEvaluatorSlideover_updateLLMEvaluatorMutation$data = {
  readonly updateLlmEvaluator: {
    readonly evaluator: {
      readonly name: string;
      readonly " $fragmentSpreads": FragmentRefs<"EvaluatorsTable_row">;
    };
  };
};
export type EditEvaluatorSlideover_updateLLMEvaluatorMutation = {
  response: EditEvaluatorSlideover_updateLLMEvaluatorMutation$data;
  variables: EditEvaluatorSlideover_updateLLMEvaluatorMutation$variables;
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditEvaluatorSlideover_updateLLMEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "LLMEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "updateLlmEvaluator",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "LLMEvaluator",
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              (v2/*: any*/),
              {
                "kind": "InlineDataFragmentSpread",
                "name": "EvaluatorsTable_row",
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v3/*: any*/),
                      (v2/*: any*/),
                      (v4/*: any*/),
                      (v5/*: any*/),
                      (v6/*: any*/),
                      (v7/*: any*/),
                      {
                        "alias": null,
                        "args": [
                          {
                            "kind": "Variable",
                            "name": "datasetId",
                            "variableName": "datasetId"
                          }
                        ],
                        "kind": "ScalarField",
                        "name": "isAssignedToDataset",
                        "storageKey": null
                      }
                    ],
                    "type": "Evaluator",
                    "abstractKey": "__isEvaluator"
                  }
                ],
                "args": null,
                "argumentDefinitions": [
                  {
                    "defaultValue": null,
                    "kind": "LocalArgument",
                    "name": "datasetId"
                  }
                ]
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditEvaluatorSlideover_updateLLMEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "LLMEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "updateLlmEvaluator",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "LLMEvaluator",
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "isAssignedToDataset",
                    "storageKey": null
                  }
                ],
                "type": "Evaluator",
                "abstractKey": "__isEvaluator"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "1e8f508f800923c791984e7217690a4c",
    "id": null,
    "metadata": {},
    "name": "EditEvaluatorSlideover_updateLLMEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation EditEvaluatorSlideover_updateLLMEvaluatorMutation(\n  $input: UpdateLLMEvaluatorInput!\n) {\n  updateLlmEvaluator(input: $input) {\n    evaluator {\n      name\n      ...EvaluatorsTable_row\n      id\n    }\n  }\n}\n\nfragment EvaluatorsTable_row on Evaluator {\n  __isEvaluator: __typename\n  id\n  name\n  kind\n  description\n  createdAt\n  updatedAt\n  isAssignedToDataset\n}\n"
  }
};
})();

(node as any).hash = "20ead923ea611bfade3b6bd66055e8fa";

export default node;
