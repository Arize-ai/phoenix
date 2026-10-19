/**
 * @generated SignedSource<<a644472fb5926a2c30edf4c653cf4c54>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsDecisionsPageLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsDecisionsPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLabelsSettingsCardFragment">;
};
export type settingsDecisionsPageLoaderQuery = {
  response: settingsDecisionsPageLoaderQuery$data;
  variables: settingsDecisionsPageLoaderQuery$variables;
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
    "name": "settingsDecisionsPageLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DecisionLabelsSettingsCardFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "settingsDecisionsPageLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "DecisionLabelConnection",
        "kind": "LinkedField",
        "name": "decisionLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DecisionLabelEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionLabel",
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
                    "name": "description",
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
                    "name": "usageCount",
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
        "storageKey": "decisionLabels(first:100)"
      },
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "filters": null,
        "handle": "connection",
        "key": "DecisionLabelsTable__decisionLabels",
        "kind": "LinkedHandle",
        "name": "decisionLabels"
      }
    ]
  },
  "params": {
    "cacheID": "22ea051fb5b38cdcb52234c1fdbc9cfe",
    "id": null,
    "metadata": {},
    "name": "settingsDecisionsPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsDecisionsPageLoaderQuery {\n  ...DecisionLabelsSettingsCardFragment\n}\n\nfragment DecisionLabelsSettingsCardFragment on Query {\n  ...DecisionLabelsTableFragment\n}\n\nfragment DecisionLabelsTableFragment on Query {\n  decisionLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        description\n        color\n        usageCount\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "05d8171316691408abbb38bd65d02711";

export default node;
