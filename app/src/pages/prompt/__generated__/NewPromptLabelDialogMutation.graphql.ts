/**
 * @generated SignedSource<<57f3350a48cffd67d2823fb8a56d4003>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreatePromptLabelInput = {
  color: string;
  description?: string | null;
  name: string;
};
export type NewPromptLabelDialogMutation$variables = {
  connections: ReadonlyArray<string>;
  label: CreatePromptLabelInput;
};
export type NewPromptLabelDialogMutation$data = {
  readonly createPromptLabel: {
    readonly promptLabels: ReadonlyArray<{
      readonly color: string;
      readonly id: string;
      readonly name: string;
    }>;
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_allLabels">;
    };
  };
};
export type NewPromptLabelDialogMutation = {
  response: NewPromptLabelDialogMutation$data;
  variables: NewPromptLabelDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "label"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "label"
  }
],
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
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "color",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "PromptLabel",
  "kind": "LinkedField",
  "name": "promptLabels",
  "plural": true,
  "selections": [
    (v3/*: any*/),
    (v4/*: any*/),
    (v5/*: any*/)
  ],
  "storageKey": null
},
v7 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "NewPromptLabelDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createPromptLabel",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptLabelConfigButton_allLabels"
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
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "NewPromptLabelDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createPromptLabel",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "promptLabels",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "PromptLabelEdge"
              }
            ]
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
                "args": (v7/*: any*/),
                "concreteType": "PromptLabelConnection",
                "kind": "LinkedField",
                "name": "promptLabels",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptLabelEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptLabel",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v4/*: any*/),
                          (v5/*: any*/),
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
                "storageKey": "promptLabels(first:100)"
              },
              {
                "alias": null,
                "args": (v7/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "PromptLabelConfigButtonAllLabels_promptLabels",
                "kind": "LinkedHandle",
                "name": "promptLabels"
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
    "cacheID": "74b9fe6f07899c8629b9afb10c988066",
    "id": null,
    "metadata": {},
    "name": "NewPromptLabelDialogMutation",
    "operationKind": "mutation",
    "text": "mutation NewPromptLabelDialogMutation(\n  $label: CreatePromptLabelInput!\n) {\n  createPromptLabel(input: $label) {\n    promptLabels {\n      id\n      name\n      color\n    }\n    query {\n      ...PromptLabelConfigButton_allLabels\n    }\n  }\n}\n\nfragment PromptLabelConfigButton_allLabels on Query {\n  promptLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        color\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "41ecdffa3587955120ba8c3831d557de";

export default node;
