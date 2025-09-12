/**
 * @generated SignedSource<<8b53e052c92d0a2c4b8e671122adacb7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelConfigButtonQuery$variables = {
  promptId: string;
};
export type PromptLabelConfigButtonQuery$data = {
  readonly prompt: {
    readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_promptLabels">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_allLabels">;
};
export type PromptLabelConfigButtonQuery = {
  response: PromptLabelConfigButtonQuery$data;
  variables: PromptLabelConfigButtonQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "promptId"
  }
],
v2 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
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
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptLabelConfigButtonQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "PromptLabelConfigButton_allLabels"
      },
      {
        "alias": "prompt",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptLabelConfigButton_promptLabels"
              }
            ],
            "type": "Prompt",
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
    "name": "PromptLabelConfigButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
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
                    "name": "color",
                    "storageKey": null
                  },
                  (v4/*: any*/)
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
        "args": (v2/*: any*/),
        "filters": null,
        "handle": "connection",
        "key": "PromptLabelConfigButtonAllLabels_promptLabels",
        "kind": "LinkedHandle",
        "name": "promptLabels"
      },
      {
        "alias": "prompt",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptLabel",
                "kind": "LinkedField",
                "name": "labels",
                "plural": true,
                "selections": [
                  (v3/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Prompt",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "67960ced83d40c14dc1d3890f90f4bcb",
    "id": null,
    "metadata": {},
    "name": "PromptLabelConfigButtonQuery",
    "operationKind": "query",
    "text": "query PromptLabelConfigButtonQuery(\n  $promptId: ID!\n) {\n  ...PromptLabelConfigButton_allLabels\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      ...PromptLabelConfigButton_promptLabels\n    }\n    id\n  }\n}\n\nfragment PromptLabelConfigButton_allLabels on Query {\n  promptLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        color\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment PromptLabelConfigButton_promptLabels on Prompt {\n  id\n  labels {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "6132c2b2eddbfe35151799dd19505d7e";

export default node;
