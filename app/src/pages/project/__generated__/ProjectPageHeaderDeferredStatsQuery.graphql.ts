/**
 * @generated SignedSource<<d7d28223e7c827fa7018eaba0192073e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectPageHeaderDeferredStatsQuery$variables = {
  id: string;
  timeRange: TimeRange;
};
export type ProjectPageHeaderDeferredStatsQuery$data = {
  readonly project: {
    readonly id?: string;
    readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeaderDeferredMetrics_project" | "ProjectPageHeaderDeferredSummaryNames_project">;
  };
};
export type ProjectPageHeaderDeferredStatsQuery = {
  response: ProjectPageHeaderDeferredStatsQuery$data;
  variables: ProjectPageHeaderDeferredStatsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
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
},
v4 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageHeaderDeferredStatsQuery",
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
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              {
                "kind": "Defer",
                "selections": [
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "ProjectPageHeaderDeferredMetrics_project"
                  }
                ]
              },
              {
                "kind": "Defer",
                "selections": [
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "ProjectPageHeaderDeferredSummaryNames_project"
                  }
                ]
              }
            ],
            "type": "Project",
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
    "name": "ProjectPageHeaderDeferredStatsQuery",
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
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "if": null,
                "kind": "Defer",
                "label": "ProjectPageHeaderDeferredStatsQuery$defer$ProjectPageHeaderDeferredMetrics",
                "selections": [
                  {
                    "alias": null,
                    "args": [
                      (v3/*: any*/)
                    ],
                    "concreteType": "SpanCostSummary",
                    "kind": "LinkedField",
                    "name": "costSummary",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "CostBreakdown",
                        "kind": "LinkedField",
                        "name": "total",
                        "plural": false,
                        "selections": (v4/*: any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "CostBreakdown",
                        "kind": "LinkedField",
                        "name": "prompt",
                        "plural": false,
                        "selections": (v4/*: any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "CostBreakdown",
                        "kind": "LinkedField",
                        "name": "completion",
                        "plural": false,
                        "selections": (v4/*: any*/),
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": "latencyMsP50",
                    "args": [
                      {
                        "kind": "Literal",
                        "name": "probability",
                        "value": 0.5
                      },
                      (v3/*: any*/)
                    ],
                    "kind": "ScalarField",
                    "name": "latencyMsQuantile",
                    "storageKey": null
                  },
                  {
                    "alias": "latencyMsP99",
                    "args": [
                      {
                        "kind": "Literal",
                        "name": "probability",
                        "value": 0.99
                      },
                      (v3/*: any*/)
                    ],
                    "kind": "ScalarField",
                    "name": "latencyMsQuantile",
                    "storageKey": null
                  }
                ]
              },
              {
                "if": null,
                "kind": "Defer",
                "label": "ProjectPageHeaderDeferredStatsQuery$defer$ProjectPageHeaderDeferredSummaryNames",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "spanAnnotationNames",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "documentEvaluationNames",
                    "storageKey": null
                  }
                ]
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
    "cacheID": "1517411d3a823bec4886bdfa5f4b7462",
    "id": null,
    "metadata": {},
    "name": "ProjectPageHeaderDeferredStatsQuery",
    "operationKind": "query",
    "text": "query ProjectPageHeaderDeferredStatsQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      id\n      ...ProjectPageHeaderDeferredMetrics_project @defer(label: \"ProjectPageHeaderDeferredStatsQuery$defer$ProjectPageHeaderDeferredMetrics\")\n      ...ProjectPageHeaderDeferredSummaryNames_project @defer(label: \"ProjectPageHeaderDeferredStatsQuery$defer$ProjectPageHeaderDeferredSummaryNames\")\n    }\n    id\n  }\n}\n\nfragment ProjectPageHeaderDeferredMetrics_project on Project {\n  costSummary(timeRange: $timeRange) {\n    total {\n      cost\n    }\n    prompt {\n      cost\n    }\n    completion {\n      cost\n    }\n  }\n  latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)\n  latencyMsP99: latencyMsQuantile(probability: 0.99, timeRange: $timeRange)\n}\n\nfragment ProjectPageHeaderDeferredSummaryNames_project on Project {\n  spanAnnotationNames\n  documentEvaluationNames\n}\n"
  }
};
})();

(node as any).hash = "d8531b014484b57176d4154b4fe5ad85";

export default node;
