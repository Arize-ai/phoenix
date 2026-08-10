/**
 * @generated SignedSource<<eb6275fe1095c29d8ff4c2eaa4d8d86e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeBinScale = "DAY" | "HOUR" | "MINUTE" | "MONTH" | "WEEK" | "YEAR";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type TimeBinConfig = {
  scale?: TimeBinScale;
  utcOffsetMinutes?: number;
};
export type ProjectAnnotationMetricsTraceQuery$variables = {
  annotationName: string;
  projectId: string;
  timeBinConfig: TimeBinConfig;
  timeRange: TimeRange;
};
export type ProjectAnnotationMetricsTraceQuery$data = {
  readonly project: {
    readonly traceAnnotationMetricsTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly annotationSummaries: ReadonlyArray<{
          readonly labelFractions: ReadonlyArray<{
            readonly fraction: number;
            readonly label: string;
          }>;
          readonly meanScore: number | null;
          readonly name: string;
        }>;
        readonly timestamp: string;
      }>;
    };
    readonly " $fragmentSpreads": FragmentRefs<"ProjectAnnotationConfigFragment">;
  };
};
export type ProjectAnnotationMetricsTraceQuery = {
  response: ProjectAnnotationMetricsTraceQuery$data;
  variables: ProjectAnnotationMetricsTraceQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "annotationName"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeBinConfig"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v5 = {
  "kind": "Literal",
  "name": "first",
  "value": 1
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "annotationName",
      "variableName": "annotationName"
    },
    {
      "kind": "Variable",
      "name": "timeBinConfig",
      "variableName": "timeBinConfig"
    },
    {
      "kind": "Variable",
      "name": "timeRange",
      "variableName": "timeRange"
    }
  ],
  "concreteType": "AnnotationMetricsTimeSeries",
  "kind": "LinkedField",
  "name": "traceAnnotationMetricsTimeSeries",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "AnnotationMetricsTimeSeriesDataPoint",
      "kind": "LinkedField",
      "name": "data",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "timestamp",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "AnnotationSummary",
          "kind": "LinkedField",
          "name": "annotationSummaries",
          "plural": true,
          "selections": [
            (v6/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "meanScore",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "LabelFraction",
              "kind": "LinkedField",
              "name": "labelFractions",
              "plural": true,
              "selections": [
                (v7/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "fraction",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectAnnotationMetricsTraceQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": [
                  {
                    "items": [
                      {
                        "kind": "Variable",
                        "name": "annotationConfigNames.0",
                        "variableName": "annotationName"
                      }
                    ],
                    "kind": "ListValue",
                    "name": "annotationConfigNames"
                  },
                  (v5/*:: as any*/)
                ],
                "kind": "FragmentSpread",
                "name": "ProjectAnnotationConfigFragment"
              },
              (v8/*:: as any*/)
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
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/),
      (v3/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectAnnotationMetricsTraceQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v9/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": [
                  (v5/*:: as any*/),
                  {
                    "items": [
                      {
                        "kind": "Variable",
                        "name": "names.0",
                        "variableName": "annotationName"
                      }
                    ],
                    "kind": "ListValue",
                    "name": "names"
                  }
                ],
                "concreteType": "AnnotationConfigConnection",
                "kind": "LinkedField",
                "name": "annotationConfigs",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "AnnotationConfigEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "config",
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v9/*:: as any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v6/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "annotationType",
                                "storageKey": null
                              }
                            ],
                            "type": "AnnotationConfigBase",
                            "abstractKey": "__isAnnotationConfigBase"
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v10/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "CategoricalAnnotationValue",
                                "kind": "LinkedField",
                                "name": "values",
                                "plural": true,
                                "selections": [
                                  (v7/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "score",
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "CategoricalAnnotationConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v10/*:: as any*/),
                              (v11/*:: as any*/),
                              (v12/*:: as any*/)
                            ],
                            "type": "ContinuousAnnotationConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v10/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "threshold",
                                "storageKey": null
                              },
                              (v11/*:: as any*/),
                              (v12/*:: as any*/)
                            ],
                            "type": "FreeformAnnotationConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v13/*:: as any*/)
                            ],
                            "type": "Node",
                            "abstractKey": "__isNode"
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v8/*:: as any*/)
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v13/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f5db769fed772e0f9d8f94b06d3e8b9b",
    "id": null,
    "metadata": {},
    "name": "ProjectAnnotationMetricsTraceQuery",
    "operationKind": "query",
    "text": "query ProjectAnnotationMetricsTraceQuery(\n  $projectId: ID!\n  $annotationName: String!\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      ...ProjectAnnotationConfigFragment_3DyRD9\n      traceAnnotationMetricsTimeSeries(annotationName: $annotationName, timeRange: $timeRange, timeBinConfig: $timeBinConfig) {\n        data {\n          timestamp\n          annotationSummaries {\n            name\n            meanScore\n            labelFractions {\n              label\n              fraction\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ProjectAnnotationConfigFragment_3DyRD9 on Project {\n  annotationConfigs(first: 1, names: [$annotationName]) {\n    edges {\n      config: node {\n        __typename\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n          annotationType\n        }\n        ... on CategoricalAnnotationConfig {\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on FreeformAnnotationConfig {\n          optimizationDirection\n          threshold\n          lowerBound\n          upperBound\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9e505987fcabb2ac5434d3e1a5a81099";

export default node;
