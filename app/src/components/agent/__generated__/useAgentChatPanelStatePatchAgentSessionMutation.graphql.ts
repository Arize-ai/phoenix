/**
 * @generated SignedSource<<888c8c4d5a5fc113d8a748ece8c67bed>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type PatchAgentSessionInput = {
  id: string;
  model?: AgentModelSelectionInput | null;
  title?: string | null;
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
  provider: ModelProvider;
};
export type useAgentChatPanelStatePatchAgentSessionMutation$variables = {
  input: PatchAgentSessionInput;
};
export type useAgentChatPanelStatePatchAgentSessionMutation$data = {
  readonly patchAgentSession: {
    readonly agentSession: {
      readonly id: string;
      readonly " $fragmentSpreads": FragmentRefs<"agentSessionModel_session">;
    };
  };
};
export type useAgentChatPanelStatePatchAgentSessionMutation$rawResponse = {
  readonly patchAgentSession: {
    readonly agentSession: {
      readonly id: string;
      readonly model: {
        readonly __typename: "AgentBuiltinProviderModelSelection";
        readonly modelName: string;
        readonly provider: ModelProvider;
      } | {
        readonly __typename: "AgentCustomProviderModelSelection";
        readonly modelName: string;
        readonly providerId: string;
      } | {
        readonly __typename: string;
      };
    };
  };
};
export type useAgentChatPanelStatePatchAgentSessionMutation = {
  rawResponse: useAgentChatPanelStatePatchAgentSessionMutation$rawResponse;
  response: useAgentChatPanelStatePatchAgentSessionMutation$data;
  variables: useAgentChatPanelStatePatchAgentSessionMutation$variables;
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
        (v3/*:: as any*/)
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
    "name": "useAgentChatPanelStatePatchAgentSessionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PatchAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "patchAgentSession",
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
    "name": "useAgentChatPanelStatePatchAgentSessionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PatchAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "patchAgentSession",
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
    "cacheID": "cbd47e1cd326914b88a81a1aadaeb775",
    "id": null,
    "metadata": {},
    "name": "useAgentChatPanelStatePatchAgentSessionMutation",
    "operationKind": "mutation",
    "text": "mutation useAgentChatPanelStatePatchAgentSessionMutation(\n  $input: PatchAgentSessionInput!\n) {\n  patchAgentSession(input: $input) {\n    agentSession {\n      id\n      ...agentSessionModel_session\n    }\n  }\n}\n\nfragment agentSessionModel_session on AgentSession {\n  model {\n    __typename\n    ... on AgentBuiltinProviderModelSelection {\n      provider\n      modelName\n    }\n    ... on AgentCustomProviderModelSelection {\n      providerId\n      modelName\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5678ddb8baaaae2f58c2368cdc2c08b4";

export default node;
