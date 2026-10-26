/**
 * @generated SignedSource<<9e92531cfd92453d66446ce38ee0f39d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionLabelConfigButtonQuery$variables = {
  decisionId: string;
};
export type DecisionLabelConfigButtonQuery$data = {
  readonly decision: {
    readonly " $fragmentSpreads": FragmentRefs<"DecisionLabelConfigButton_decisionLabels">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLabelConfigButton_allLabels">;
};
export type DecisionLabelConfigButtonQuery = {
  response: DecisionLabelConfigButtonQuery$data;
  variables: DecisionLabelConfigButtonQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "decisionId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "decisionId"
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionLabelConfigButtonQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DecisionLabelConfigButton_allLabels"
      },
      {
        "alias": "decision",
        "args": (v1/*:: as any*/),
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
                "name": "DecisionLabelConfigButton_decisionLabels"
              }
            ],
            "type": "Decision",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DecisionLabelConfigButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
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
                  (v3/*:: as any*/),
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
                  (v4/*:: as any*/)
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
        "args": (v2/*:: as any*/),
        "filters": null,
        "handle": "connection",
        "key": "DecisionLabelConfigButtonAllLabels_decisionLabels",
        "kind": "LinkedHandle",
        "name": "decisionLabels"
      },
      {
        "alias": "decision",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionLabel",
                "kind": "LinkedField",
                "name": "labels",
                "plural": true,
                "selections": [
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Decision",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8f5233a0a9e3d47b3ec798a06c7fdf14",
    "id": null,
    "metadata": {},
    "name": "DecisionLabelConfigButtonQuery",
    "operationKind": "query",
    "text": "query DecisionLabelConfigButtonQuery(\n  $decisionId: ID!\n) {\n  ...DecisionLabelConfigButton_allLabels\n  decision: node(id: $decisionId) {\n    __typename\n    ... on Decision {\n      ...DecisionLabelConfigButton_decisionLabels\n    }\n    id\n  }\n}\n\nfragment DecisionLabelConfigButton_allLabels on Query {\n  decisionLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        color\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment DecisionLabelConfigButton_decisionLabels on Decision {\n  id\n  labels {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "dea2cf1fc27bb1425e0b32eb6ddd9c35";

export default node;
