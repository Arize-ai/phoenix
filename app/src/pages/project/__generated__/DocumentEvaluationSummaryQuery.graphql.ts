/**
 * @generated SignedSource<<e1fe1405bf2c86d28af66c567db7164b>>
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
export type DocumentEvaluationSummaryQuery$variables = {
  evaluationName: string;
  id: string;
  timeRange: TimeRange;
};
export type DocumentEvaluationSummaryQuery$data = {
  readonly project: {
    readonly " $fragmentSpreads": FragmentRefs<"DocumentEvaluationSummaryValueFragment">;
  };
};
export type DocumentEvaluationSummaryQuery = {
  response: DocumentEvaluationSummaryQuery$data;
  variables: DocumentEvaluationSummaryQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "evaluationName"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
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
    "variableName": "id"
  }
],
v2 = [
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DocumentEvaluationSummaryQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": (v2/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DocumentEvaluationSummaryQuery",
    "selections": [
      {
        "alias": "project",
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
                "args": (v2/*: any*/),
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
    "cacheID": "3ebd1cf66ef8f31c995ec6aae6505e94",
    "id": null,
    "metadata": {},
    "name": "DocumentEvaluationSummaryQuery",
    "operationKind": "query",
    "text": "query DocumentEvaluationSummaryQuery(\n  $evaluationName: String!\n  $id: GlobalID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $id) {\n    __typename\n    ...DocumentEvaluationSummaryValueFragment_1dJL9N\n    __isNode: __typename\n    id\n  }\n}\n\nfragment DocumentEvaluationSummaryValueFragment_1dJL9N on Project {\n  documentEvaluationSummary(evaluationName: $evaluationName, timeRange: $timeRange) {\n    averageNdcg\n    averagePrecision\n    meanReciprocalRank\n    hitRate\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "4d50474ffa9b9e4a68d07f6e0777c144";

export default node;
