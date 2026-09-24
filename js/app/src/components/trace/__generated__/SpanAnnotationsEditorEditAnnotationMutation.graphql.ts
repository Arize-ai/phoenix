/**
 * @generated SignedSource<<f27094efbf9b78229f85a2d0fcedbcb3>>
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
export type SpanAnnotationsEditorEditAnnotationMutation$variables = {
  annotationId: string;
  explanation?: string | null;
  filterUserIds?: ReadonlyArray<string | null> | null;
  label?: string | null;
  name: string;
  projectId: string;
  score?: number | null;
  spanId: string;
  timeRange: TimeRange;
};
export type SpanAnnotationsEditorEditAnnotationMutation$data = {
  readonly patchSpanAnnotations: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup" | "SpanAnnotationsEditor_spanAnnotations" | "SpanAnnotationsTable_annotations">;
      };
      readonly project: {
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryValueFragment">;
      };
    };
  };
};
export type SpanAnnotationsEditorEditAnnotationMutation = {
  response: SpanAnnotationsEditorEditAnnotationMutation$data;
  variables: SpanAnnotationsEditorEditAnnotationMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "annotationId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "explanation"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterUserIds"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "label"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "score"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "spanId"
},
v8 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v9 = [
  {
    "items": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "annotationId",
            "variableName": "annotationId"
          },
          {
            "kind": "Literal",
            "name": "annotatorKind",
            "value": "HUMAN"
          },
          {
            "kind": "Variable",
            "name": "explanation",
            "variableName": "explanation"
          },
          {
            "kind": "Variable",
            "name": "label",
            "variableName": "label"
          },
          {
            "kind": "Variable",
            "name": "name",
            "variableName": "name"
          },
          {
            "kind": "Variable",
            "name": "score",
            "variableName": "score"
          },
          {
            "kind": "Literal",
            "name": "source",
            "value": "APP"
          }
        ],
        "kind": "ObjectValue",
        "name": "input.0"
      }
    ],
    "kind": "ListValue",
    "name": "input"
  }
],
v10 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v11 = [
  {
    "kind": "Variable",
    "name": "annotationName",
    "variableName": "name"
  },
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v12 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v15 = {
  "kind": "Literal",
  "name": "first",
  "value": 1
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v22 = [
  (v13/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v16/*:: as any*/),
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
          (v17/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "CategoricalAnnotationValue",
            "kind": "LinkedField",
            "name": "values",
            "plural": true,
            "selections": [
              (v18/*:: as any*/),
              (v19/*:: as any*/)
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
          (v17/*:: as any*/),
          (v20/*:: as any*/),
          (v21/*:: as any*/)
        ],
        "type": "ContinuousAnnotationConfig",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v17/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "threshold",
            "storageKey": null
          },
          (v20/*:: as any*/),
          (v21/*:: as any*/)
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
      (v14/*:: as any*/)
    ],
    "type": "Node",
    "abstractKey": "__isNode"
  }
],
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "fraction",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v25 = {
  "names": [
    "note"
  ]
},
v26 = [
  {
    "kind": "Literal",
    "name": "filter",
    "value": {
      "exclude": (v25/*:: as any*/)
    }
  }
],
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/),
      (v5/*:: as any*/),
      (v6/*:: as any*/),
      (v7/*:: as any*/),
      (v8/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanAnnotationsEditorEditAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v9/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "patchSpanAnnotations",
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
                "args": (v10/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "args": (v11/*:: as any*/),
                        "kind": "FragmentSpread",
                        "name": "AnnotationSummaryValueFragment"
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
                "args": (v12/*:: as any*/),
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
      (v7/*:: as any*/),
      (v0/*:: as any*/),
      (v4/*:: as any*/),
      (v3/*:: as any*/),
      (v6/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v8/*:: as any*/),
      (v5/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "SpanAnnotationsEditorEditAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v9/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "patchSpanAnnotations",
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
                "args": (v10/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v13/*:: as any*/),
                  (v14/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": [
                          {
                            "fields": [
                              {
                                "items": [
                                  {
                                    "kind": "Variable",
                                    "name": "annotationNames.0",
                                    "variableName": "name"
                                  }
                                ],
                                "kind": "ListValue",
                                "name": "annotationNames"
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
                                  (v16/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "evaluator",
                                    "plural": false,
                                    "selections": [
                                      (v13/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": null,
                                        "kind": "LinkedField",
                                        "name": "outputConfigs",
                                        "plural": true,
                                        "selections": (v22/*:: as any*/),
                                        "storageKey": null
                                      },
                                      (v14/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  },
                                  (v14/*:: as any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": [
                          (v15/*:: as any*/),
                          {
                            "items": [
                              {
                                "kind": "Variable",
                                "name": "names.0",
                                "variableName": "name"
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
                                "selections": (v22/*:: as any*/),
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": (v11/*:: as any*/),
                        "concreteType": "AnnotationSummary",
                        "kind": "LinkedField",
                        "name": "spanAnnotationSummary",
                        "plural": false,
                        "selections": [
                          (v16/*:: as any*/),
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
                              (v18/*:: as any*/),
                              (v23/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v24/*:: as any*/)
                        ],
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
                "args": (v12/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v13/*:: as any*/),
                  (v14/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": "summarySpanAnnotations",
                        "args": (v26/*:: as any*/),
                        "concreteType": "SpanAnnotation",
                        "kind": "LinkedField",
                        "name": "spanAnnotations",
                        "plural": true,
                        "selections": [
                          (v14/*:: as any*/),
                          (v16/*:: as any*/),
                          (v18/*:: as any*/),
                          (v19/*:: as any*/),
                          (v27/*:: as any*/),
                          (v28/*:: as any*/),
                          (v29/*:: as any*/),
                          (v30/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "user",
                            "plural": false,
                            "selections": [
                              (v31/*:: as any*/),
                              (v32/*:: as any*/),
                              (v14/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": "spanAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                      },
                      {
                        "alias": "summarySpanAnnotationSummaries",
                        "args": (v26/*:: as any*/),
                        "concreteType": "AnnotationSummary",
                        "kind": "LinkedField",
                        "name": "spanAnnotationSummaries",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "LabelFraction",
                            "kind": "LinkedField",
                            "name": "labelFractions",
                            "plural": true,
                            "selections": [
                              (v23/*:: as any*/),
                              (v18/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v24/*:: as any*/),
                          (v16/*:: as any*/)
                        ],
                        "storageKey": "spanAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                      },
                      {
                        "alias": "filteredSpanAnnotations",
                        "args": [
                          {
                            "fields": [
                              {
                                "kind": "Literal",
                                "name": "exclude",
                                "value": (v25/*:: as any*/)
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
                          (v14/*:: as any*/),
                          (v16/*:: as any*/),
                          (v28/*:: as any*/),
                          (v19/*:: as any*/),
                          (v18/*:: as any*/),
                          (v27/*:: as any*/),
                          (v29/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SpanAnnotation",
                        "kind": "LinkedField",
                        "name": "spanAnnotations",
                        "plural": true,
                        "selections": [
                          (v14/*:: as any*/),
                          (v16/*:: as any*/),
                          (v18/*:: as any*/),
                          (v19/*:: as any*/),
                          (v27/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "metadata",
                            "storageKey": null
                          },
                          (v28/*:: as any*/),
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
                          (v29/*:: as any*/),
                          (v30/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "user",
                            "plural": false,
                            "selections": [
                              (v14/*:: as any*/),
                              (v31/*:: as any*/),
                              (v32/*:: as any*/)
                            ],
                            "storageKey": null
                          }
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
    "cacheID": "8c55c4459e01503370d0ea966e21face",
    "id": null,
    "metadata": {},
    "name": "SpanAnnotationsEditorEditAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation SpanAnnotationsEditorEditAnnotationMutation(\n  $spanId: ID!\n  $annotationId: ID!\n  $name: String!\n  $label: String\n  $score: Float\n  $explanation: String\n  $filterUserIds: [ID]\n  $timeRange: TimeRange!\n  $projectId: ID!\n) {\n  patchSpanAnnotations(input: [{annotationId: $annotationId, name: $name, label: $label, score: $score, explanation: $explanation, annotatorKind: HUMAN, source: APP}]) {\n    query {\n      project: node(id: $projectId) {\n        __typename\n        ... on Project {\n          ...AnnotationSummaryValueFragment_20r1YH\n        }\n        id\n      }\n      node(id: $spanId) {\n        __typename\n        ... on Span {\n          ...AnnotationSummaryGroup\n          ...SpanAnnotationsEditor_spanAnnotations_3lpqY\n          ...SpanAnnotationsTable_annotations\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  summarySpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}}) {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  summarySpanAnnotationSummaries: spanAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment AnnotationSummaryValueFragment_20r1YH on Project {\n  ...ProjectAnnotationConfigsByNameFragment_3q9JyO\n  spanAnnotationSummary(annotationName: $name, timeRange: $timeRange) {\n    name\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      label\n      fraction\n    }\n    meanScore\n  }\n  id\n}\n\nfragment ProjectAnnotationConfigsByNameFragment_3q9JyO on Project {\n  evaluators(first: 1, filter: {annotationNames: [$name]}) {\n    edges {\n      node {\n        name\n        evaluator {\n          __typename\n          outputConfigs {\n            __typename\n            ...useProjectAnnotationConfigsByName_config\n            ... on Node {\n              __isNode: __typename\n              id\n            }\n          }\n          id\n        }\n        id\n      }\n    }\n  }\n  annotationConfigs(first: 1, names: [$name]) {\n    edges {\n      config: node {\n        __typename\n        ...useProjectAnnotationConfigsByName_config\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment SpanAnnotationsEditor_spanAnnotations_3lpqY on Span {\n  id\n  filteredSpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}, include: {userIds: $filterUserIds}}) {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n    createdAt\n  }\n}\n\nfragment SpanAnnotationsTable_annotations on Span {\n  id\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    metadata\n    annotatorKind\n    identifier\n    source\n    createdAt\n    updatedAt\n    user {\n      id\n      username\n      profilePictureUrl\n    }\n  }\n}\n\nfragment useProjectAnnotationConfigsByName_config on AnnotationConfigBase {\n  __isAnnotationConfigBase: __typename\n  name\n  annotationType\n  ... on CategoricalAnnotationConfig {\n    optimizationDirection\n    values {\n      label\n      score\n    }\n  }\n  ... on ContinuousAnnotationConfig {\n    optimizationDirection\n    lowerBound\n    upperBound\n  }\n  ... on FreeformAnnotationConfig {\n    optimizationDirection\n    threshold\n    lowerBound\n    upperBound\n  }\n}\n"
  }
};
})();

(node as any).hash = "be8ec658b9f5f8f95432bb3662f16803";

export default node;
