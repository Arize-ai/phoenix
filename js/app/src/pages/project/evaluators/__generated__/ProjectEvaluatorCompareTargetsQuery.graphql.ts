/**
 * @generated SignedSource<<bbfaa1a79e61ce55bcd13b6cc1c536d9>>
 * @lightSyntaxTransform
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
export type ProjectEvaluatorCompareTargetsQuery$variables = {
  condition: string;
  id: string;
  isSession: boolean;
  isSpan: boolean;
  isTrace: boolean;
  rootSpansOnly: boolean;
  timeRange: TimeRange;
};
export type ProjectEvaluatorCompareTargetsQuery$data = {
  readonly project: {
    readonly " $fragmentSpreads": FragmentRefs<"SessionsTable_sessions" | "SpansTable_spans" | "TracesTable_spans">;
  };
};
export type ProjectEvaluatorCompareTargetsQuery = {
  response: ProjectEvaluatorCompareTargetsQuery$data;
  variables: ProjectEvaluatorCompareTargetsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "condition"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "isSession"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "isSpan"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "isTrace"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "rootSpansOnly"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v7 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v8 = {
  "kind": "Variable",
  "name": "filterCondition",
  "variableName": "condition"
},
v9 = {
  "kind": "Variable",
  "name": "traceFilterCondition",
  "variableName": "condition"
},
v10 = {
  "kind": "Variable",
  "name": "sessionFilterCondition",
  "variableName": "condition"
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanAnnotationNames",
  "storageKey": null
},
v15 = {
  "kind": "Literal",
  "name": "first",
  "value": 100
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v21 = [
  (v11/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v13/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "annotationType",
        "storageKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v16/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "CategoricalAnnotationValue",
            "kind": "LinkedField",
            "name": "values",
            "plural": true,
            "selections": [
              (v17/*:: as any*/),
              (v18/*:: as any*/)
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
          (v16/*:: as any*/),
          (v19/*:: as any*/),
          (v20/*:: as any*/)
        ],
        "type": "ContinuousAnnotationConfig",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v16/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "threshold",
            "storageKey": null
          },
          (v19/*:: as any*/),
          (v20/*:: as any*/)
        ],
        "type": "FreeformAnnotationConfig",
        "abstractKey": null
      }
    ],
    "type": "AnnotationConfigBase",
    "abstractKey": "__isAnnotationConfigBase"
  },
  {
    "kind": "InlineFragment",
    "selections": [
      (v12/*:: as any*/)
    ],
    "type": "Node",
    "abstractKey": "__isNode"
  }
],
v22 = {
  "alias": null,
  "args": [
    {
      "fields": [
        {
          "kind": "Literal",
          "name": "annotationNames",
          "value": null
        }
      ],
      "kind": "ObjectValue",
      "name": "filter"
    },
    (v15/*:: as any*/)
  ],
  "concreteType": "ProjectEvaluatorConnection",
  "kind": "LinkedField",
  "name": "evaluators",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ProjectEvaluatorEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ProjectEvaluator",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v13/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "evaluator",
              "plural": false,
              "selections": [
                (v11/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "outputConfigs",
                  "plural": true,
                  "selections": (v21/*:: as any*/),
                  "storageKey": null
                },
                (v12/*:: as any*/)
              ],
              "storageKey": null
            },
            (v12/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": "evaluators(filter:{\"annotationNames\":null},first:100)"
},
v23 = {
  "alias": null,
  "args": [
    (v15/*:: as any*/)
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
          "selections": (v21/*:: as any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": "annotationConfigs(first:100)"
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceAnnotationNames",
  "storageKey": null
},
v25 = {
  "kind": "Literal",
  "name": "first",
  "value": 30
},
v26 = {
  "kind": "Literal",
  "name": "sort",
  "value": {
    "col": "startTime",
    "dir": "desc"
  }
},
v27 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v28 = [
  (v8/*:: as any*/),
  (v25/*:: as any*/),
  (v26/*:: as any*/),
  (v27/*:: as any*/)
],
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "userId",
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusCode",
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusMessage",
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v36 = {
  "alias": null,
  "args": null,
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
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cost",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v37 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cumulativeTokenCountTotal",
  "storageKey": null
},
v38 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanId",
  "storageKey": null
},
v39 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v40 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v41 = [
  {
    "kind": "Literal",
    "name": "filter",
    "value": {
      "exclude": {
        "names": [
          "note"
        ]
      }
    }
  }
],
v42 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v43 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v44 = [
  (v12/*:: as any*/),
  (v13/*:: as any*/),
  (v17/*:: as any*/),
  (v18/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "explanation",
    "storageKey": null
  },
  (v42/*:: as any*/),
  (v43/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "updatedAt",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "user",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "username",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "profilePictureUrl",
        "storageKey": null
      },
      (v12/*:: as any*/)
    ],
    "storageKey": null
  }
],
v45 = {
  "alias": "summaryTraceAnnotations",
  "args": (v41/*:: as any*/),
  "concreteType": "TraceAnnotation",
  "kind": "LinkedField",
  "name": "traceAnnotations",
  "plural": true,
  "selections": (v44/*:: as any*/),
  "storageKey": "traceAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]}})"
},
v46 = {
  "alias": null,
  "args": null,
  "concreteType": "LabelFraction",
  "kind": "LinkedField",
  "name": "labelFractions",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "fraction",
      "storageKey": null
    },
    (v17/*:: as any*/)
  ],
  "storageKey": null
},
v47 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v48 = [
  (v40/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "scoreCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "labelCount",
    "storageKey": null
  },
  (v46/*:: as any*/),
  (v47/*:: as any*/),
  (v13/*:: as any*/)
],
v49 = {
  "alias": "summaryTraceAnnotationSummaries",
  "args": (v41/*:: as any*/),
  "concreteType": "AnnotationSummary",
  "kind": "LinkedField",
  "name": "traceAnnotationSummaries",
  "plural": true,
  "selections": (v48/*:: as any*/),
  "storageKey": "traceAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
},
v50 = [
  {
    "alias": "value",
    "args": null,
    "kind": "ScalarField",
    "name": "truncatedValue",
    "storageKey": null
  }
],
v51 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v50/*:: as any*/),
  "storageKey": null
},
v52 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v50/*:: as any*/),
  "storageKey": null
},
v53 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanAnnotations",
  "plural": true,
  "selections": [
    (v12/*:: as any*/),
    (v13/*:: as any*/),
    (v17/*:: as any*/),
    (v18/*:: as any*/),
    (v42/*:: as any*/),
    (v43/*:: as any*/)
  ],
  "storageKey": null
},
v54 = {
  "alias": null,
  "args": null,
  "concreteType": "DocumentRetrievalMetrics",
  "kind": "LinkedField",
  "name": "documentRetrievalMetrics",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ndcg",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "precision",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hit",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v55 = {
  "alias": "summarySpanAnnotations",
  "args": (v41/*:: as any*/),
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanAnnotations",
  "plural": true,
  "selections": (v44/*:: as any*/),
  "storageKey": "spanAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]}})"
},
v56 = {
  "alias": "summarySpanAnnotationSummaries",
  "args": (v41/*:: as any*/),
  "concreteType": "AnnotationSummary",
  "kind": "LinkedField",
  "name": "spanAnnotationSummaries",
  "plural": true,
  "selections": [
    (v46/*:: as any*/),
    (v47/*:: as any*/),
    (v13/*:: as any*/)
  ],
  "storageKey": "spanAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
},
v57 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v58 = [
  (v11/*:: as any*/),
  (v12/*:: as any*/)
],
v59 = {
  "alias": null,
  "args": null,
  "concreteType": "Span",
  "kind": "LinkedField",
  "name": "node",
  "plural": false,
  "selections": (v58/*:: as any*/),
  "storageKey": null
},
v60 = {
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
},
v61 = [
  {
    "kind": "Literal",
    "name": "filterCondition",
    "value": "parent_span is None"
  },
  (v25/*:: as any*/),
  (v26/*:: as any*/),
  (v27/*:: as any*/),
  (v9/*:: as any*/)
],
v62 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v63 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v64 = [
  (v25/*:: as any*/),
  (v10/*:: as any*/),
  (v26/*:: as any*/),
  (v27/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/),
      (v5/*:: as any*/),
      (v6/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorCompareTargetsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v7/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "condition": "isSpan",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  {
                    "args": [
                      (v8/*:: as any*/),
                      {
                        "kind": "Variable",
                        "name": "rootSpansOnly",
                        "variableName": "rootSpansOnly"
                      }
                    ],
                    "kind": "FragmentSpread",
                    "name": "SpansTable_spans"
                  }
                ]
              },
              {
                "condition": "isTrace",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  {
                    "args": [
                      (v9/*:: as any*/)
                    ],
                    "kind": "FragmentSpread",
                    "name": "TracesTable_spans"
                  }
                ]
              },
              {
                "condition": "isSession",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  {
                    "args": [
                      (v10/*:: as any*/)
                    ],
                    "kind": "FragmentSpread",
                    "name": "SessionsTable_sessions"
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
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v6/*:: as any*/),
      (v0/*:: as any*/),
      (v5/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorCompareTargetsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v7/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v11/*:: as any*/),
          (v12/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "condition": "isSpan",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  (v13/*:: as any*/),
                  (v14/*:: as any*/),
                  (v22/*:: as any*/),
                  (v23/*:: as any*/),
                  (v24/*:: as any*/),
                  {
                    "alias": null,
                    "args": (v28/*:: as any*/),
                    "concreteType": "SpanConnection",
                    "kind": "LinkedField",
                    "name": "spans",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SpanEdge",
                        "kind": "LinkedField",
                        "name": "edges",
                        "plural": true,
                        "selections": [
                          {
                            "alias": "span",
                            "args": null,
                            "concreteType": "Span",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": [
                              (v12/*:: as any*/),
                              (v29/*:: as any*/),
                              (v13/*:: as any*/),
                              (v30/*:: as any*/),
                              (v31/*:: as any*/),
                              (v32/*:: as any*/),
                              (v33/*:: as any*/),
                              (v34/*:: as any*/),
                              (v35/*:: as any*/),
                              {
                                "condition": "rootSpansOnly",
                                "kind": "Condition",
                                "passingValue": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "tokenCountTotal",
                                    "storageKey": null
                                  },
                                  (v36/*:: as any*/)
                                ]
                              },
                              {
                                "condition": "rootSpansOnly",
                                "kind": "Condition",
                                "passingValue": true,
                                "selections": [
                                  (v37/*:: as any*/)
                                ]
                              },
                              (v38/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Trace",
                                "kind": "LinkedField",
                                "name": "trace",
                                "plural": false,
                                "selections": [
                                  (v12/*:: as any*/),
                                  (v39/*:: as any*/),
                                  {
                                    "condition": "rootSpansOnly",
                                    "kind": "Condition",
                                    "passingValue": true,
                                    "selections": [
                                      (v36/*:: as any*/)
                                    ]
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "AnnotationSummary",
                                    "kind": "LinkedField",
                                    "name": "traceAnnotationSummaries",
                                    "plural": true,
                                    "selections": [
                                      (v40/*:: as any*/),
                                      (v13/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  },
                                  (v45/*:: as any*/),
                                  (v49/*:: as any*/)
                                ],
                                "storageKey": null
                              },
                              (v51/*:: as any*/),
                              (v52/*:: as any*/),
                              (v53/*:: as any*/),
                              (v54/*:: as any*/),
                              (v55/*:: as any*/),
                              (v56/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v57/*:: as any*/),
                          (v59/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      (v60/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v28/*:: as any*/),
                    "filters": [
                      "sort",
                      "filterCondition",
                      "projectEvaluatorId",
                      "timeRange"
                    ],
                    "handle": "connection",
                    "key": "SpansTable_spans",
                    "kind": "LinkedHandle",
                    "name": "spans"
                  }
                ]
              },
              {
                "condition": "isTrace",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  (v13/*:: as any*/),
                  (v22/*:: as any*/),
                  (v23/*:: as any*/),
                  (v14/*:: as any*/),
                  (v24/*:: as any*/),
                  {
                    "alias": "rootSpans",
                    "args": (v61/*:: as any*/),
                    "concreteType": "SpanConnection",
                    "kind": "LinkedField",
                    "name": "spans",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SpanEdge",
                        "kind": "LinkedField",
                        "name": "edges",
                        "plural": true,
                        "selections": [
                          {
                            "alias": "rootSpan",
                            "args": null,
                            "concreteType": "Span",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": [
                              (v12/*:: as any*/),
                              (v29/*:: as any*/),
                              (v13/*:: as any*/),
                              (v30/*:: as any*/),
                              (v32/*:: as any*/),
                              (v33/*:: as any*/),
                              (v34/*:: as any*/),
                              (v62/*:: as any*/),
                              (v35/*:: as any*/),
                              (v37/*:: as any*/),
                              (v63/*:: as any*/),
                              (v51/*:: as any*/),
                              (v52/*:: as any*/),
                              (v38/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Trace",
                                "kind": "LinkedField",
                                "name": "trace",
                                "plural": false,
                                "selections": [
                                  (v12/*:: as any*/),
                                  (v39/*:: as any*/),
                                  (v31/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "numSpans",
                                    "storageKey": null
                                  },
                                  (v36/*:: as any*/),
                                  (v45/*:: as any*/),
                                  (v49/*:: as any*/)
                                ],
                                "storageKey": null
                              },
                              (v53/*:: as any*/),
                              (v55/*:: as any*/),
                              (v56/*:: as any*/),
                              (v54/*:: as any*/),
                              {
                                "alias": null,
                                "args": [
                                  {
                                    "kind": "Literal",
                                    "name": "first",
                                    "value": 50
                                  }
                                ],
                                "concreteType": "SpanConnection",
                                "kind": "LinkedField",
                                "name": "descendants",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "SpanEdge",
                                    "kind": "LinkedField",
                                    "name": "edges",
                                    "plural": true,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "Span",
                                        "kind": "LinkedField",
                                        "name": "node",
                                        "plural": false,
                                        "selections": [
                                          (v12/*:: as any*/),
                                          (v29/*:: as any*/),
                                          (v13/*:: as any*/),
                                          {
                                            "alias": "statusCode",
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "propagatedStatusCode",
                                            "storageKey": null
                                          },
                                          (v33/*:: as any*/),
                                          (v34/*:: as any*/),
                                          (v62/*:: as any*/),
                                          (v35/*:: as any*/),
                                          (v63/*:: as any*/),
                                          {
                                            "alias": "cumulativeTokenCountTotal",
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "tokenCountTotal",
                                            "storageKey": null
                                          },
                                          (v51/*:: as any*/),
                                          (v52/*:: as any*/),
                                          (v38/*:: as any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "Trace",
                                            "kind": "LinkedField",
                                            "name": "trace",
                                            "plural": false,
                                            "selections": [
                                              (v12/*:: as any*/),
                                              (v39/*:: as any*/)
                                            ],
                                            "storageKey": null
                                          },
                                          (v53/*:: as any*/),
                                          (v55/*:: as any*/),
                                          (v56/*:: as any*/),
                                          (v54/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": "descendants(first:50)"
                              }
                            ],
                            "storageKey": null
                          },
                          (v57/*:: as any*/),
                          (v59/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      (v60/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": "rootSpans",
                    "args": (v61/*:: as any*/),
                    "filters": [
                      "sort",
                      "filterCondition",
                      "traceFilterCondition",
                      "timeRange"
                    ],
                    "handle": "connection",
                    "key": "TracesTable_rootSpans",
                    "kind": "LinkedHandle",
                    "name": "spans"
                  }
                ]
              },
              {
                "condition": "isSession",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  (v13/*:: as any*/),
                  (v22/*:: as any*/),
                  (v23/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "sessionAnnotationNames",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v64/*:: as any*/),
                    "concreteType": "ProjectSessionConnection",
                    "kind": "LinkedField",
                    "name": "sessions",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ProjectSessionEdge",
                        "kind": "LinkedField",
                        "name": "edges",
                        "plural": true,
                        "selections": [
                          {
                            "alias": "session",
                            "args": null,
                            "concreteType": "ProjectSession",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": [
                              (v12/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "sessionId",
                                "storageKey": null
                              },
                              (v31/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "numTraces",
                                "storageKey": null
                              },
                              (v34/*:: as any*/),
                              (v62/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanIOValue",
                                "kind": "LinkedField",
                                "name": "firstInput",
                                "plural": false,
                                "selections": (v50/*:: as any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanIOValue",
                                "kind": "LinkedField",
                                "name": "lastOutput",
                                "plural": false,
                                "selections": (v50/*:: as any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "TokenUsage",
                                "kind": "LinkedField",
                                "name": "tokenUsage",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "total",
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": "traceLatencyMsP50",
                                "args": [
                                  {
                                    "kind": "Literal",
                                    "name": "probability",
                                    "value": 0.5
                                  }
                                ],
                                "kind": "ScalarField",
                                "name": "traceLatencyMsQuantile",
                                "storageKey": "traceLatencyMsQuantile(probability:0.5)"
                              },
                              {
                                "alias": "traceLatencyMsP99",
                                "args": [
                                  {
                                    "kind": "Literal",
                                    "name": "probability",
                                    "value": 0.99
                                  }
                                ],
                                "kind": "ScalarField",
                                "name": "traceLatencyMsQuantile",
                                "storageKey": "traceLatencyMsQuantile(probability:0.99)"
                              },
                              (v36/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "ProjectSessionAnnotation",
                                "kind": "LinkedField",
                                "name": "sessionAnnotations",
                                "plural": true,
                                "selections": (v44/*:: as any*/),
                                "storageKey": null
                              },
                              {
                                "alias": "summarySessionAnnotationSummaries",
                                "args": (v41/*:: as any*/),
                                "concreteType": "AnnotationSummary",
                                "kind": "LinkedField",
                                "name": "sessionAnnotationSummaries",
                                "plural": true,
                                "selections": (v48/*:: as any*/),
                                "storageKey": "sessionAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                              }
                            ],
                            "storageKey": null
                          },
                          (v57/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ProjectSession",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": (v58/*:: as any*/),
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      (v60/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v64/*:: as any*/),
                    "filters": [
                      "sort",
                      "sessionFilterCondition",
                      "timeRange"
                    ],
                    "handle": "connection",
                    "key": "SessionsTable_sessions",
                    "kind": "LinkedHandle",
                    "name": "sessions"
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
    "cacheID": "73f5a8191bcd215f1828105624af8ec5",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorCompareTargetsQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorCompareTargetsQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n  $condition: String!\n  $rootSpansOnly: Boolean!\n  $isSpan: Boolean!\n  $isTrace: Boolean!\n  $isSession: Boolean!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      ...SpansTable_spans_fIxGt @include(if: $isSpan)\n      ...TracesTable_spans_1Z0wvm @include(if: $isTrace)\n      ...SessionsTable_sessions_1bCQfo @include(if: $isSession)\n    }\n    id\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  summarySpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}}) {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  summarySpanAnnotationSummaries: spanAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment ProjectAnnotationConfigsByNameFragment on Project {\n  evaluators(first: 100, filter: {}) {\n    edges {\n      node {\n        name\n        evaluator {\n          __typename\n          outputConfigs {\n            __typename\n            ...useProjectAnnotationConfigsByName_config\n            ... on Node {\n              __isNode: __typename\n              id\n            }\n          }\n          id\n        }\n        id\n      }\n    }\n  }\n  annotationConfigs(first: 100) {\n    edges {\n      config: node {\n        __typename\n        ...useProjectAnnotationConfigsByName_config\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment SessionAnnotationSummaryGroup on ProjectSession {\n  sessionAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  summarySessionAnnotationSummaries: sessionAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment SessionColumnSelector_annotations on Project {\n  sessionAnnotationNames\n}\n\nfragment SessionsTable_sessions_1bCQfo on Project {\n  id\n  name\n  ...ProjectAnnotationConfigsByNameFragment\n  ...SessionColumnSelector_annotations\n  sessions(first: 30, sort: {col: startTime, dir: desc}, sessionFilterCondition: $condition, timeRange: $timeRange) {\n    edges {\n      session: node {\n        id\n        sessionId\n        userId\n        numTraces\n        startTime\n        endTime\n        firstInput {\n          value: truncatedValue\n        }\n        lastOutput {\n          value: truncatedValue\n        }\n        tokenUsage {\n          total\n        }\n        traceLatencyMsP50: traceLatencyMsQuantile(probability: 0.5)\n        traceLatencyMsP99: traceLatencyMsQuantile(probability: 0.99)\n        costSummary {\n          total {\n            cost\n          }\n        }\n        ...SessionAnnotationSummaryGroup\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment SpanColumnSelector_annotations on Project {\n  spanAnnotationNames\n}\n\nfragment SpanColumnSelector_traceAnnotations on Project {\n  traceAnnotationNames\n}\n\nfragment SpansTable_spans_fIxGt on Project {\n  name\n  spanAnnotationNames\n  ...ProjectAnnotationConfigsByNameFragment\n  ...SpanColumnSelector_annotations\n  ...SpanColumnSelector_traceAnnotations\n  spans(first: 30, sort: {col: startTime, dir: desc}, filterCondition: $condition, timeRange: $timeRange) {\n    edges {\n      span: node {\n        id\n        spanKind\n        name\n        metadata\n        userId\n        statusCode\n        statusMessage\n        startTime\n        latencyMs\n        tokenCountTotal @skip(if: $rootSpansOnly)\n        costSummary @skip(if: $rootSpansOnly) {\n          total {\n            cost\n          }\n        }\n        cumulativeTokenCountTotal @include(if: $rootSpansOnly)\n        spanId\n        trace {\n          id\n          traceId\n          costSummary @include(if: $rootSpansOnly) {\n            total {\n              cost\n            }\n          }\n          traceAnnotationSummaries {\n            count\n            name\n          }\n          ...TraceAnnotationSummaryGroup\n        }\n        input {\n          value: truncatedValue\n        }\n        output {\n          value: truncatedValue\n        }\n        spanAnnotations {\n          id\n          name\n          label\n          score\n          annotatorKind\n          createdAt\n        }\n        documentRetrievalMetrics {\n          evaluationName\n          ndcg\n          precision\n          hit\n        }\n        ...AnnotationSummaryGroup\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment TraceAnnotationSummaryGroup on Trace {\n  summaryTraceAnnotations: traceAnnotations(filter: {exclude: {names: [\"note\"]}}) {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  summaryTraceAnnotationSummaries: traceAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment TracesTable_spans_1Z0wvm on Project {\n  id\n  name\n  ...ProjectAnnotationConfigsByNameFragment\n  ...SpanColumnSelector_annotations\n  ...SpanColumnSelector_traceAnnotations\n  rootSpans: spans(first: 30, sort: {col: startTime, dir: desc}, filterCondition: \"parent_span is None\", traceFilterCondition: $condition, timeRange: $timeRange) {\n    edges {\n      rootSpan: node {\n        id\n        spanKind\n        name\n        metadata\n        statusCode\n        statusMessage\n        startTime\n        endTime\n        latencyMs\n        cumulativeTokenCountTotal\n        parentId\n        input {\n          value: truncatedValue\n        }\n        output {\n          value: truncatedValue\n        }\n        spanId\n        trace {\n          id\n          traceId\n          userId\n          numSpans\n          costSummary {\n            total {\n              cost\n            }\n          }\n          ...TraceAnnotationSummaryGroup\n        }\n        spanAnnotations {\n          id\n          name\n          label\n          score\n          annotatorKind\n          createdAt\n        }\n        ...AnnotationSummaryGroup\n        documentRetrievalMetrics {\n          evaluationName\n          ndcg\n          precision\n          hit\n        }\n        descendants(first: 50) {\n          edges {\n            node {\n              id\n              spanKind\n              name\n              statusCode: propagatedStatusCode\n              statusMessage\n              startTime\n              endTime\n              latencyMs\n              parentId\n              cumulativeTokenCountTotal: tokenCountTotal\n              input {\n                value: truncatedValue\n              }\n              output {\n                value: truncatedValue\n              }\n              spanId\n              trace {\n                id\n                traceId\n              }\n              spanAnnotations {\n                id\n                name\n                label\n                score\n                annotatorKind\n                createdAt\n              }\n              ...AnnotationSummaryGroup\n              documentRetrievalMetrics {\n                evaluationName\n                ndcg\n                precision\n                hit\n              }\n            }\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment useProjectAnnotationConfigsByName_config on AnnotationConfigBase {\n  __isAnnotationConfigBase: __typename\n  name\n  annotationType\n  ... on CategoricalAnnotationConfig {\n    optimizationDirection\n    values {\n      label\n      score\n    }\n  }\n  ... on ContinuousAnnotationConfig {\n    optimizationDirection\n    lowerBound\n    upperBound\n  }\n  ... on FreeformAnnotationConfig {\n    optimizationDirection\n    threshold\n    lowerBound\n    upperBound\n  }\n}\n"
  }
};
})();

(node as any).hash = "1caa8f6a2e84969ed669b37b9ab6d8c6";

export default node;
