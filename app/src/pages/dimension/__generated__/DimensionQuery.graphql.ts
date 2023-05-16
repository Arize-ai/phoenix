/**
 * @generated SignedSource<<e8149c9e2eb4ac2cb050fab0838aae84>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeRange = {
  end: string;
  start: string;
};
export type DimensionQuery$variables = {
  dimensionId: string;
  timeRange: TimeRange;
};
export type DimensionQuery$data = {
  readonly dimension: {
    readonly id?: string;
    readonly " $fragmentSpreads": FragmentRefs<"DimensionDriftStats_dimension">;
  };
};
export type DimensionQuery = {
  response: DimensionQuery$data;
  variables: DimensionQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "dimensionId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "dimensionId"
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
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DimensionQuery",
    "selections": [
      {
        "alias": "dimension",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              {
                "args": [
                  (v3/*: any*/)
                ],
                "kind": "FragmentSpread",
                "name": "DimensionDriftStats_dimension"
              }
            ],
            "type": "Dimension",
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
    "name": "DimensionQuery",
    "selections": [
      {
        "alias": "dimension",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
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
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": "psi",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "metric",
                    "value": "psi"
                  },
                  (v3/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "driftMetric",
                "storageKey": null
              }
            ],
            "type": "Dimension",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2adefdde42e945604eb3a532ae85d13d",
    "id": null,
    "metadata": {},
    "name": "DimensionQuery",
    "operationKind": "query",
    "text": "query DimensionQuery(\n  $dimensionId: GlobalID!\n  $timeRange: TimeRange!\n) {\n  dimension: node(id: $dimensionId) {\n    __typename\n    ... on Dimension {\n      id\n      ...DimensionDriftStats_dimension_3E0ZE6\n    }\n    __isNode: __typename\n    id\n  }\n}\n\nfragment DimensionDriftStats_dimension_3E0ZE6 on Dimension {\n  id\n  psi: driftMetric(metric: psi, timeRange: $timeRange)\n}\n"
  }
};
})();

(node as any).hash = "a21e8eff2b530fad1ec4eb261fb70b4a";

export default node;
