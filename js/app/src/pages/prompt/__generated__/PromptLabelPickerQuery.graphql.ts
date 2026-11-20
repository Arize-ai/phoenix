/**
 * @generated SignedSource<<d3e18ab0dd290ca2e22e41fb49e9bbb2>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelPickerQuery$variables = Record<PropertyKey, never>;
export type PromptLabelPickerQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelPicker_allLabels">;
};
export type PromptLabelPickerQuery = {
  response: PromptLabelPickerQuery$data;
  variables: PromptLabelPickerQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptLabelPickerQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "PromptLabelPicker_allLabels"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PromptLabelPickerQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
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
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "id",
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
                    "name": "color",
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
        "storageKey": "promptLabels(first:100)"
      },
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "filters": null,
        "handle": "connection",
        "key": "PromptLabelPicker_promptLabels",
        "kind": "LinkedHandle",
        "name": "promptLabels"
      }
    ]
  },
  "params": {
    "cacheID": "a6a4d4df5fbb1e376346c0b3f3fc3a69",
    "id": null,
    "metadata": {},
    "name": "PromptLabelPickerQuery",
    "operationKind": "query",
    "text": "query PromptLabelPickerQuery {\n  ...PromptLabelPicker_allLabels\n}\n\nfragment PromptLabelPicker_allLabels on Query {\n  promptLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        color\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5289cb1c87d46edce66c2888530dfe87";

export default node;
