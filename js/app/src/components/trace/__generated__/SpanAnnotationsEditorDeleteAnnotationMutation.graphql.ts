/**
 * @generated SignedSource<<a835dbe38e0006e59227fe1c0f626fcb>>
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
export type SpanAnnotationsEditorDeleteAnnotationMutation$variables = {
  annotationIds: ReadonlyArray<string>;
  filterUserIds?: ReadonlyArray<string | null> | null;
  projectId: string;
  spanId: string;
  timeRange: TimeRange;
};
export type SpanAnnotationsEditorDeleteAnnotationMutation$data = {
  readonly deleteSpanAnnotations: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup" | "SpanAnnotationsEditor_spanAnnotations" | "SpanAnnotationsTable_annotations">;
      };
      readonly project: {
        readonly " $fragmentSpreads": FragmentRefs<"ProjectStats_project">;
      };
    };
  };
};
export type SpanAnnotationsEditorDeleteAnnotationMutation = {
  response: SpanAnnotationsEditorDeleteAnnotationMutation$data;
  variables: SpanAnnotationsEditorDeleteAnnotationMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "annotationIds"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterUserIds"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "spanId"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v5 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "annotationIds",
        "variableName": "annotationIds"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v6 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v7 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v10 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v11 = [
  (v10/*:: as any*/)
],
v12 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
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
  "name": "label",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanAnnotationsEditorDeleteAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v5/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "deleteSpanAnnotations",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": "project",
                "args": (v6/*:: as any*/),
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
                        "name": "ProjectStats_project"
                      }
                    ],
                    "type": "Project",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
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
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "AnnotationSummaryGroup"
                      },
                      {
                        "args": [
                          {
                            "kind": "Variable",
                            "name": "filterUserIds",
                            "variableName": "filterUserIds"
                          }
                        ],
                        "kind": "FragmentSpread",
                        "name": "SpanAnnotationsEditor_spanAnnotations"
                      },
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "SpanAnnotationsTable_annotations"
                      }
                    ],
                    "type": "Span",
                    "abstractKey": null
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
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v3/*:: as any*/),
      (v0/*:: as any*/),
      (v4/*:: as any*/),
      (v2/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "SpanAnnotationsEditorDeleteAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v5/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "deleteSpanAnnotations",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": "project",
                "args": (v6/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v8/*:: as any*/),
                  (v9/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": "timeRangeTraceCount",
                        "args": (v11/*:: as any*/),
                        "kind": "ScalarField",
                        "name": "traceCount",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": (v11/*:: as any*/),
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
                            "selections": (v12/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "CostBreakdown",
                            "kind": "LinkedField",
                            "name": "prompt",
                            "plural": false,
                            "selections": (v12/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "CostBreakdown",
                            "kind": "LinkedField",
                            "name": "completion",
                            "plural": false,
                            "selections": (v12/*:: as any*/),
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
                          (v10/*:: as any*/)
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
                          (v10/*:: as any*/)
                        ],
                        "kind": "ScalarField",
                        "name": "latencyMsQuantile",
                        "storageKey": null
                      },
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
                    ],
                    "type": "Project",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v7/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v8/*:: as any*/),
                  (v9/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SpanAnnotation",
                        "kind": "LinkedField",
                        "name": "spanAnnotations",
                        "plural": true,
                        "selections": [
                          (v9/*:: as any*/),
                          (v13/*:: as any*/),
                          (v14/*:: as any*/),
                          (v15/*:: as any*/),
                          (v16/*:: as any*/),
                          (v17/*:: as any*/),
                          (v18/*:: as any*/),
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
                              (v9/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "metadata",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "identifier",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "source",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "updatedAt",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "AnnotationSummary",
                        "kind": "LinkedField",
                        "name": "spanAnnotationSummaries",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "count",
                            "storageKey": null
                          },
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
                          {
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
                              (v14/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "meanScore",
                            "storageKey": null
                          },
                          (v13/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": "filteredSpanAnnotations",
                        "args": [
                          {
                            "fields": [
                              {
                                "kind": "Literal",
                                "name": "exclude",
                                "value": {
                                  "names": [
                                    "note"
                                  ]
                                }
                              },
                              {
                                "fields": [
                                  {
                                    "kind": "Variable",
                                    "name": "userIds",
                                    "variableName": "filterUserIds"
                                  }
                                ],
                                "kind": "ObjectValue",
                                "name": "include"
                              }
                            ],
                            "kind": "ObjectValue",
                            "name": "filter"
                          }
                        ],
                        "concreteType": "SpanAnnotation",
                        "kind": "LinkedField",
                        "name": "spanAnnotations",
                        "plural": true,
                        "selections": [
                          (v9/*:: as any*/),
                          (v13/*:: as any*/),
                          (v17/*:: as any*/),
                          (v15/*:: as any*/),
                          (v14/*:: as any*/),
                          (v16/*:: as any*/),
                          (v18/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "Span",
                    "abstractKey": null
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
    ]
  },
  "params": {
    "cacheID": "e40d8f5b00c6cbeda17cbd0ee0cc2689",
    "id": null,
    "metadata": {},
    "name": "SpanAnnotationsEditorDeleteAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation SpanAnnotationsEditorDeleteAnnotationMutation(\n  $spanId: ID!\n  $annotationIds: [ID!]!\n  $timeRange: TimeRange!\n  $projectId: ID!\n  $filterUserIds: [ID]\n) {\n  deleteSpanAnnotations(input: {annotationIds: $annotationIds}) {\n    query {\n      project: node(id: $projectId) {\n        __typename\n        ... on Project {\n          ...ProjectStats_project\n        }\n        id\n      }\n      node(id: $spanId) {\n        __typename\n        ... on Span {\n          ...AnnotationSummaryGroup\n          ...SpanAnnotationsEditor_spanAnnotations_3lpqY\n          ...SpanAnnotationsTable_annotations\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  spanAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment ProjectStats_project on Project {\n  timeRangeTraceCount: traceCount(timeRange: $timeRange)\n  costSummary(timeRange: $timeRange) {\n    total {\n      cost\n    }\n    prompt {\n      cost\n    }\n    completion {\n      cost\n    }\n  }\n  latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)\n  latencyMsP99: latencyMsQuantile(probability: 0.99, timeRange: $timeRange)\n  spanAnnotationNames\n  documentEvaluationNames\n  id\n}\n\nfragment SpanAnnotationsEditor_spanAnnotations_3lpqY on Span {\n  id\n  filteredSpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}, include: {userIds: $filterUserIds}}) {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n    createdAt\n  }\n}\n\nfragment SpanAnnotationsTable_annotations on Span {\n  id\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    metadata\n    annotatorKind\n    identifier\n    source\n    createdAt\n    updatedAt\n    user {\n      id\n      username\n      profilePictureUrl\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5b2ff93cc55b5bda5aafd7c9b1dcd93a";

export default node;
