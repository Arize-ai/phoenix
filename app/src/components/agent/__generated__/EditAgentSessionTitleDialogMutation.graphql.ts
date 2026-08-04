/**
 * @generated SignedSource<<5de9983affbf3c116593506c7772a3df>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type UpdateAgentSessionInput = {
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
  openaiApiType?: OpenAIApiType;
  provider: ModelProvider;
};
export type EditAgentSessionTitleDialogMutation$variables = {
  input: UpdateAgentSessionInput;
};
export type EditAgentSessionTitleDialogMutation$data = {
  readonly updateAgentSession: {
    readonly agentSession: {
      readonly " $fragmentSpreads": FragmentRefs<"EditAgentSessionTitleDialog_session">;
    };
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"SettingsAgentSessionsCard_sessions">;
    };
  };
};
export type EditAgentSessionTitleDialogMutation = {
  response: EditAgentSessionTitleDialogMutation$data;
  variables: EditAgentSessionTitleDialogMutation$variables;
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
  "kind": "Literal",
  "name": "first",
  "value": 20
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
  "name": "title",
  "storageKey": null
},
v5 = [
  (v2/*:: as any*/),
  {
    "kind": "Literal",
    "name": "viewerOnly",
    "value": false
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditAgentSessionTitleDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UpdateAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "updateAgentSession",
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
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "EditAgentSessionTitleDialog_session"
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "args": [
                  (v2/*:: as any*/)
                ],
                "kind": "FragmentSpread",
                "name": "SettingsAgentSessionsCard_sessions"
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
    "name": "EditAgentSessionTitleDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UpdateAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "updateAgentSession",
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
              (v3/*:: as any*/),
              (v4/*:: as any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v5/*:: as any*/),
                "concreteType": "AgentSessionConnection",
                "kind": "LinkedField",
                "name": "agentSessions",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "AgentSessionEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "AgentSession",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v4/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "user",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "username",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "profilePictureUrl",
                                "storageKey": null
                              },
                              (v3/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "firstInput",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "isActive",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "createdAt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "updatedAt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "__typename",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "cursor",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PageInfo",
                    "kind": "LinkedField",
                    "name": "pageInfo",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "endCursor",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "hasNextPage",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "agentSessions(first:20,viewerOnly:false)"
              },
              {
                "alias": null,
                "args": (v5/*:: as any*/),
                "filters": [],
                "handle": "connection",
                "key": "SettingsAgentSessionsCard_agentSessions",
                "kind": "LinkedHandle",
                "name": "agentSessions"
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
    "cacheID": "6d95a9acdfa13a80ff2e9f77935478b5",
    "id": null,
    "metadata": {},
    "name": "EditAgentSessionTitleDialogMutation",
    "operationKind": "mutation",
    "text": "mutation EditAgentSessionTitleDialogMutation(\n  $input: UpdateAgentSessionInput!\n) {\n  updateAgentSession(input: $input) {\n    agentSession {\n      ...EditAgentSessionTitleDialog_session\n      id\n    }\n    query {\n      ...SettingsAgentSessionsCard_sessions_3dfUwN\n    }\n  }\n}\n\nfragment EditAgentSessionTitleDialog_session on AgentSession {\n  id\n  title\n}\n\nfragment SettingsAgentSessionsCard_sessions_3dfUwN on Query {\n  agentSessions(first: 20, viewerOnly: false) {\n    edges {\n      node {\n        id\n        title\n        ...EditAgentSessionTitleDialog_session\n        user {\n          username\n          profilePictureUrl\n          id\n        }\n        firstInput\n        isActive\n        createdAt\n        updatedAt\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "206385849712b627a3831d7297f7265b";

export default node;
