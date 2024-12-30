/**
 * @generated SignedSource<<e76ec250e8c9ef2f02b841a2ef8f5609>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type promptVersionLoaderQuery$variables = {
  id: string;
};
export type promptVersionLoaderQuery$data = {
  readonly promptVersion: {
    readonly __typename: string;
    readonly description?: string;
    readonly id: string;
    readonly invocationParameters?: any | null;
    readonly modelName?: string;
    readonly tools?: ReadonlyArray<{
      readonly definition: any;
    }>;
    readonly user?: string | null;
    readonly " $fragmentSpreads": FragmentRefs<"PromptChatMessages__main" | "PromptCodeExportCard__main" | "PromptInvocationParameters__main">;
  };
};
export type promptVersionLoaderQuery = {
  response: promptVersionLoaderQuery$data;
  variables: promptVersionLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
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
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "invocationParameters",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "ToolDefinition",
  "kind": "LinkedField",
  "name": "tools",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "definition",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "user",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "role",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "promptVersionLoaderQuery",
    "selections": [
      {
        "alias": "promptVersion",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptInvocationParameters__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptChatMessages__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptCodeExportCard__main"
              },
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/)
            ],
            "type": "PromptVersion",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "promptVersionLoaderQuery",
    "selections": [
      {
        "alias": "promptVersion",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "template",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "messages",
                        "plural": true,
                        "selections": [
                          (v2/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v9/*: any*/),
                              {
                                "alias": "jsonContent",
                                "args": null,
                                "kind": "ScalarField",
                                "name": "content",
                                "storageKey": null
                              }
                            ],
                            "type": "JSONPromptMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v9/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "content",
                                "storageKey": null
                              }
                            ],
                            "type": "TextPromptMessage",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "PromptChatTemplate",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "template",
                        "storageKey": null
                      }
                    ],
                    "type": "PromptStringTemplate",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "templateType",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "templateFormat",
                "storageKey": null
              },
              (v6/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "modelProvider",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "JSONSchema",
                "kind": "LinkedField",
                "name": "outputSchema",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "schema",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v7/*: any*/),
              (v4/*: any*/),
              (v8/*: any*/)
            ],
            "type": "PromptVersion",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ca612db6a8c270e44675d56c67a78f04",
    "id": null,
    "metadata": {},
    "name": "promptVersionLoaderQuery",
    "operationKind": "query",
    "text": "query promptVersionLoaderQuery(\n  $id: GlobalID!\n) {\n  promptVersion: node(id: $id) {\n    __typename\n    id\n    ... on PromptVersion {\n      ...PromptInvocationParameters__main\n      ...PromptChatMessages__main\n      ...PromptCodeExportCard__main\n      description\n      invocationParameters\n      modelName\n      tools {\n        definition\n      }\n      user\n    }\n  }\n}\n\nfragment PromptChatMessages__main on PromptVersion {\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        __typename\n        ... on JSONPromptMessage {\n          role\n          jsonContent: content\n        }\n        ... on TextPromptMessage {\n          role\n          content\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateType\n  templateFormat\n}\n\nfragment PromptCodeExportCard__main on PromptVersion {\n  invocationParameters\n  modelName\n  modelProvider\n  outputSchema {\n    schema\n  }\n  tools {\n    definition\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        __typename\n        ... on JSONPromptMessage {\n          role\n          jsonContent: content\n        }\n        ... on TextPromptMessage {\n          role\n          content\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateFormat\n  templateType\n}\n\nfragment PromptInvocationParameters__main on PromptVersion {\n  invocationParameters\n}\n"
  }
};
})();

(node as any).hash = "c3d7a33362c62c6db87bda93909e0a61";

export default node;
