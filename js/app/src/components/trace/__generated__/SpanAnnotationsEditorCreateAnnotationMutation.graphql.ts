/**
 * @generated SignedSource<<397d855676373636adc8649ee1ad309c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type CreateSpanAnnotationInput = {
  annotatorKind: AnnotatorKind;
  explanation?: string | null;
  identifier?: string | null;
  label?: string | null;
  metadata: any;
  name: string;
  score?: number | null;
  source: AnnotationSource;
  spanId: string;
};
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type SpanAnnotationsEditorCreateAnnotationMutation$variables = {
  filterUserIds?: ReadonlyArray<string | null> | null;
  input: CreateSpanAnnotationInput;
  name: string;
  projectId: string;
  spanId: string;
  timeRange: TimeRange;
};
export type SpanAnnotationsEditorCreateAnnotationMutation$data = {
  readonly createSpanAnnotations: {
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
export type SpanAnnotationsEditorCreateAnnotationMutation = {
  response: SpanAnnotationsEditorCreateAnnotationMutation$data;
  variables: SpanAnnotationsEditorCreateAnnotationMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterUserIds"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "spanId"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v6 = [
  {
    "items": [
      {
        "kind": "Variable",
        "name": "input.0",
        "variableName": "input"
      }
    ],
    "kind": "ListValue",
    "name": "input"
  }
],
v7 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v8 = [
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
v9 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
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
  "name": "lowerBound",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "fraction",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v20 = {
  "names": [
    "note"
  ]
},
v21 = [
  {
    "kind": "Literal",
    "name": "filter",
    "value": {
      "exclude": (v20/*:: as any*/)
    }
  }
],
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v27 = {
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
      (v5/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanAnnotationsEditorCreateAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v6/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createSpanAnnotations",
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
                        "args": (v8/*:: as any*/),
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
                "args": (v9/*:: as any*/),
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
      (v2/*:: as any*/),
      (v1/*:: as any*/),
      (v4/*:: as any*/),
      (v0/*:: as any*/),
      (v5/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "SpanAnnotationsEditorCreateAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v6/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createSpanAnnotations",
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
                "args": (v7/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v10/*:: as any*/),
                  (v11/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "first",
                            "value": 1
                          },
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
                                "selections": [
                                  (v10/*:: as any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v12/*:: as any*/),
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
                                      (v13/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "CategoricalAnnotationValue",
                                        "kind": "LinkedField",
                                        "name": "values",
                                        "plural": true,
                                        "selections": [
                                          (v14/*:: as any*/),
                                          (v15/*:: as any*/)
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
                                      (v13/*:: as any*/),
                                      (v16/*:: as any*/),
                                      (v17/*:: as any*/)
                                    ],
                                    "type": "ContinuousAnnotationConfig",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v13/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "threshold",
                                        "storageKey": null
                                      },
                                      (v16/*:: as any*/),
                                      (v17/*:: as any*/)
                                    ],
                                    "type": "FreeformAnnotationConfig",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v11/*:: as any*/)
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
                      {
                        "alias": null,
                        "args": (v8/*:: as any*/),
                        "concreteType": "AnnotationSummary",
                        "kind": "LinkedField",
                        "name": "spanAnnotationSummary",
                        "plural": false,
                        "selections": [
                          (v12/*:: as any*/),
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
                              (v14/*:: as any*/),
                              (v18/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v19/*:: as any*/)
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
                "args": (v9/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v10/*:: as any*/),
                  (v11/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": "summarySpanAnnotations",
                        "args": (v21/*:: as any*/),
                        "concreteType": "SpanAnnotation",
                        "kind": "LinkedField",
                        "name": "spanAnnotations",
                        "plural": true,
                        "selections": [
                          (v11/*:: as any*/),
                          (v12/*:: as any*/),
                          (v14/*:: as any*/),
                          (v15/*:: as any*/),
                          (v22/*:: as any*/),
                          (v23/*:: as any*/),
                          (v24/*:: as any*/),
                          (v25/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "user",
                            "plural": false,
                            "selections": [
                              (v26/*:: as any*/),
                              (v27/*:: as any*/),
                              (v11/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": "spanAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                      },
                      {
                        "alias": "summarySpanAnnotationSummaries",
                        "args": (v21/*:: as any*/),
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
                              (v18/*:: as any*/),
                              (v14/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v19/*:: as any*/),
                          (v12/*:: as any*/)
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
                                "value": (v20/*:: as any*/)
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
                          (v11/*:: as any*/),
                          (v12/*:: as any*/),
                          (v23/*:: as any*/),
                          (v15/*:: as any*/),
                          (v14/*:: as any*/),
                          (v22/*:: as any*/),
                          (v24/*:: as any*/)
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
                          (v11/*:: as any*/),
                          (v12/*:: as any*/),
                          (v14/*:: as any*/),
                          (v15/*:: as any*/),
                          (v22/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "metadata",
                            "storageKey": null
                          },
                          (v23/*:: as any*/),
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
                          (v24/*:: as any*/),
                          (v25/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "user",
                            "plural": false,
                            "selections": [
                              (v11/*:: as any*/),
                              (v26/*:: as any*/),
                              (v27/*:: as any*/)
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
    "cacheID": "3977f9a276c97044645fbf90298300a5",
    "id": null,
    "metadata": {},
    "name": "SpanAnnotationsEditorCreateAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation SpanAnnotationsEditorCreateAnnotationMutation(\n  $name: String!\n  $input: CreateSpanAnnotationInput!\n  $spanId: ID!\n  $filterUserIds: [ID]\n  $timeRange: TimeRange!\n  $projectId: ID!\n) {\n  createSpanAnnotations(input: [$input]) {\n    query {\n      project: node(id: $projectId) {\n        __typename\n        ... on Project {\n          ...AnnotationSummaryValueFragment_20r1YH\n        }\n        id\n      }\n      node(id: $spanId) {\n        __typename\n        ... on Span {\n          ...AnnotationSummaryGroup\n          ...SpanAnnotationsEditor_spanAnnotations_3lpqY\n          ...SpanAnnotationsTable_annotations\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  summarySpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}}) {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  summarySpanAnnotationSummaries: spanAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment AnnotationSummaryValueFragment_20r1YH on Project {\n  ...ProjectAnnotationConfigsByNameFragment_3q9JyO\n  spanAnnotationSummary(annotationName: $name, timeRange: $timeRange) {\n    name\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      label\n      fraction\n    }\n    meanScore\n  }\n  id\n}\n\nfragment ProjectAnnotationConfigsByNameFragment_3q9JyO on Project {\n  annotationConfigs(first: 1, names: [$name]) {\n    edges {\n      config: node {\n        __typename\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n          annotationType\n        }\n        ... on CategoricalAnnotationConfig {\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on FreeformAnnotationConfig {\n          optimizationDirection\n          threshold\n          lowerBound\n          upperBound\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment SpanAnnotationsEditor_spanAnnotations_3lpqY on Span {\n  id\n  filteredSpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}, include: {userIds: $filterUserIds}}) {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n    createdAt\n  }\n}\n\nfragment SpanAnnotationsTable_annotations on Span {\n  id\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    metadata\n    annotatorKind\n    identifier\n    source\n    createdAt\n    updatedAt\n    user {\n      id\n      username\n      profilePictureUrl\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "07cb13039f734deaaaea42a644330598";

export default node;
