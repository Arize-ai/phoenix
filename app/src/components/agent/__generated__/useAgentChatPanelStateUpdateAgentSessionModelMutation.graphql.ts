/**
 * @generated SignedSource<<51addb04e925f71719ab1b1b7bb37f60>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type UpdateAgentSessionModelInput = {
  id: string;
  model: AgentModelSelectionInput;
};
export type AgentModelSelectionInput = {
  builtin?: never;
  custom: AgentCustomProviderModelSelectionInput;
} | {
  builtin: AgentBuiltinProviderModelSelectionInput;
  custom?: never;
};
export type AgentCustomProviderModelSelectionInput = {
  modelName: string;
  providerId: string;
};
export type AgentBuiltinProviderModelSelectionInput = {
  modelName: string;
  openaiApiType?: OpenAIApiType;
  provider: ModelProvider;
};
export type useAgentChatPanelStateUpdateAgentSessionModelMutation$variables = {
  input: UpdateAgentSessionModelInput;
};
export type useAgentChatPanelStateUpdateAgentSessionModelMutation$data = {
  readonly updateAgentSessionModel: {
    readonly agentSession: {
      readonly id: string;
      readonly " $fragmentSpreads": FragmentRefs<"agentSessionModel_session">;
    };
  };
};
export type useAgentChatPanelStateUpdateAgentSessionModelMutation = {
  response: useAgentChatPanelStateUpdateAgentSessionModelMutation$data;
  variables: useAgentChatPanelStateUpdateAgentSessionModelMutation$variables;
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
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "model",
  "plural": false,
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
          "kind": "ScalarField",
          "name": "provider",
          "storageKey": null
        },
        (v3/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "openaiApiType",
          "storageKey": null
        }
      ],
      "type": "AgentBuiltinProviderModelSelection",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "providerId",
          "storageKey": null
        },
        (v3/*:: as any*/)
      ],
      "type": "AgentCustomProviderModelSelection",
      "abstractKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useAgentChatPanelStateUpdateAgentSessionModelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UpdateAgentSessionModelMutationPayload",
        "kind": "LinkedField",
        "name": "updateAgentSessionModel",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "AgentSession",
            "kind": "LinkedField",
            "name": "agentSession",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              {
                "kind": "InlineDataFragmentSpread",
                "name": "agentSessionModel_session",
                "selections": [
                  (v4/*:: as any*/)
                ],
                "args": null,
                "argumentDefinitions": []
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useAgentChatPanelStateUpdateAgentSessionModelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UpdateAgentSessionModelMutationPayload",
        "kind": "LinkedField",
        "name": "updateAgentSessionModel",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "AgentSession",
            "kind": "LinkedField",
            "name": "agentSession",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              (v4/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "44a04c64447e27be245749d9b8768c8b",
    "id": null,
    "metadata": {},
    "name": "useAgentChatPanelStateUpdateAgentSessionModelMutation",
    "operationKind": "mutation",
    "text": "mutation useAgentChatPanelStateUpdateAgentSessionModelMutation(\n  $input: UpdateAgentSessionModelInput!\n) {\n  updateAgentSessionModel(input: $input) {\n    agentSession {\n      id\n      ...agentSessionModel_session\n    }\n  }\n}\n\nfragment agentSessionModel_session on AgentSession {\n  model {\n    __typename\n    ... on AgentBuiltinProviderModelSelection {\n      provider\n      modelName\n      openaiApiType\n    }\n    ... on AgentCustomProviderModelSelection {\n      providerId\n      modelName\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c2182307dca6494f070185e4e92c65ab";

export default node;
