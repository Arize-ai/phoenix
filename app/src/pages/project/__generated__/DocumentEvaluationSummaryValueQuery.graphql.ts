/**
 * @generated SignedSource<<eb1441a6fa51d5f393026b7cd14db970>>
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
export type DocumentEvaluationSummaryValueQuery$variables = {
  evaluationName: string;
  id: string;
  timeRange: TimeRange;
};
export type DocumentEvaluationSummaryValueQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"DocumentEvaluationSummaryValueFragment">;
  };
};
export type DocumentEvaluationSummaryValueQuery = {
  response: DocumentEvaluationSummaryValueQuery$data;
  variables: DocumentEvaluationSummaryValueQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "evaluationName"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v4 = [
  {
    "kind": "Variable",
    "name": "evaluationName",
    "variableName": "evaluationName"
  },
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DocumentEvaluationSummaryValueQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": (v4/*: any*/),
            "kind": "FragmentSpread",
            "name": "DocumentEvaluationSummaryValueFragment"
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v2/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "DocumentEvaluationSummaryValueQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v4/*: any*/),
                "concreteType": "DocumentEvaluationSummary",
                "kind": "LinkedField",
                "name": "documentEvaluationSummary",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "averageNdcg",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "averagePrecision",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "meanReciprocalRank",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "hitRate",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "60d7798d88e1408e6b6b0bebdc1716f5",
    "id": null,
    "metadata": {},
    "name": "DocumentEvaluationSummaryValueQuery",
    "operationKind": "query",
    "text": "query DocumentEvaluationSummaryValueQuery(\n  $evaluationName: String!\n  $timeRange: TimeRange!\n  $id: GlobalID!\n) {\n  node(id: $id) {\n    __typename\n    ...DocumentEvaluationSummaryValueFragment_1dJL9N\n    __isNode: __typename\n    id\n  }\n}\n\nfragment DocumentEvaluationSummaryValueFragment_1dJL9N on Project {\n  documentEvaluationSummary(evaluationName: $evaluationName, timeRange: $timeRange) {\n    averageNdcg\n    averagePrecision\n    meanReciprocalRank\n    hitRate\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "15d0652aa260c80f62acec943f615d93";

export default node;
