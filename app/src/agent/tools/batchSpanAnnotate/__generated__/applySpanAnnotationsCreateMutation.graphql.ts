/**
 * @generated SignedSource<<9e61a13016ba0d1cc50a21a8a9e3562a>>
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
export type applySpanAnnotationsCreateMutation$variables = {
  filterUserIds?: ReadonlyArray<string | null> | null;
  input: ReadonlyArray<CreateSpanAnnotationInput>;
};
export type applySpanAnnotationsCreateMutation$data = {
  readonly createSpanAnnotations: {
    readonly spanAnnotations: ReadonlyArray<{
      readonly span: {
        readonly __typename: "Span";
        readonly id: string;
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup" | "SpanAnnotationsEditor_spanAnnotations">;
      };
    }>;
  };
};
export type applySpanAnnotationsCreateMutation = {
  response: applySpanAnnotationsCreateMutation$data;
  variables: applySpanAnnotationsCreateMutation$variables;
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
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
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
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v12 = {
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
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "applySpanAnnotationsCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createSpanAnnotations",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "SpanAnnotation",
            "kind": "LinkedField",
            "name": "spanAnnotations",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "span",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
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
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "applySpanAnnotationsCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createSpanAnnotations",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "SpanAnnotation",
            "kind": "LinkedField",
            "name": "spanAnnotations",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "span",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Project",
                    "kind": "LinkedField",
                    "name": "project",
                    "plural": false,
                    "selections": [
                      (v3/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
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
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "node",
                                "plural": false,
                                "selections": [
                                  (v4/*:: as any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v5/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "description",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "annotationType",
                                        "storageKey": null
                                      },
                                      (v6/*:: as any*/),
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          (v7/*:: as any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "CategoricalAnnotationValue",
                                            "kind": "LinkedField",
                                            "name": "values",
                                            "plural": true,
                                            "selections": [
                                              (v8/*:: as any*/),
                                              (v9/*:: as any*/)
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
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "lowerBound",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "upperBound",
                                            "storageKey": null
                                          },
                                          (v7/*:: as any*/)
                                        ],
                                        "type": "ContinuousAnnotationConfig",
                                        "abstractKey": null
                                      },
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          (v7/*:: as any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "threshold",
                                            "storageKey": null
                                          }
                                        ],
                                        "type": "FreeformAnnotationConfig",
                                        "abstractKey": null
                                      }
                                    ],
                                    "type": "AnnotationConfigBase",
                                    "abstractKey": "__isAnnotationConfigBase"
                                  },
                                  (v6/*:: as any*/)
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
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SpanAnnotation",
                    "kind": "LinkedField",
                    "name": "spanAnnotations",
                    "plural": true,
                    "selections": [
                      (v3/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v5/*:: as any*/),
                          (v8/*:: as any*/),
                          (v9/*:: as any*/),
                          (v10/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "metadata",
                            "storageKey": null
                          },
                          (v11/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "source",
                            "storageKey": null
                          },
                          (v12/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "user",
                            "plural": false,
                            "selections": [
                              (v3/*:: as any*/),
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
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "kind": "TypeDiscriminator",
                            "abstractKey": "__isNode"
                          }
                        ],
                        "type": "Annotation",
                        "abstractKey": "__isAnnotation"
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
                          (v8/*:: as any*/)
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
                      (v5/*:: as any*/)
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
                      (v3/*:: as any*/),
                      (v5/*:: as any*/),
                      (v11/*:: as any*/),
                      (v9/*:: as any*/),
                      (v8/*:: as any*/),
                      (v10/*:: as any*/),
                      (v12/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v3/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "0ab08d10a1f18b1f04b9f801588be59d",
    "id": null,
    "metadata": {},
    "name": "applySpanAnnotationsCreateMutation",
    "operationKind": "mutation",
    "text": "mutation applySpanAnnotationsCreateMutation(\n  $input: [CreateSpanAnnotationInput!]!\n  $filterUserIds: [ID]\n) {\n  createSpanAnnotations(input: $input) {\n    spanAnnotations {\n      span {\n        id\n        __typename\n        ...AnnotationSummaryGroup\n        ...SpanAnnotationsEditor_spanAnnotations_3lpqY\n      }\n      id\n    }\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  id\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ...ConnectedDetailPanelAnnotationBarConfigFields\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  spanAnnotations {\n    ...ConnectedDetailPanelAnnotationBarAnnotationFields\n    id\n  }\n  spanAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment ConnectedDetailPanelAnnotationBarAnnotationFields on Annotation {\n  __isAnnotation: __typename\n  ... on Node {\n    __isNode: __typename\n    id\n  }\n  name\n  label\n  score\n  explanation\n  metadata\n  annotatorKind\n  source\n  createdAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n}\n\nfragment ConnectedDetailPanelAnnotationBarConfigFields on AnnotationConfigBase {\n  __isAnnotationConfigBase: __typename\n  __typename\n  ... on Node {\n    __isNode: __typename\n    id\n  }\n  name\n  description\n  annotationType\n  ... on CategoricalAnnotationConfig {\n    optimizationDirection\n    values {\n      label\n      score\n    }\n  }\n  ... on ContinuousAnnotationConfig {\n    lowerBound\n    upperBound\n    optimizationDirection\n  }\n  ... on FreeformAnnotationConfig {\n    optimizationDirection\n    threshold\n  }\n}\n\nfragment SpanAnnotationsEditor_spanAnnotations_3lpqY on Span {\n  id\n  filteredSpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}, include: {userIds: $filterUserIds}}) {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n    createdAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "b222f2449a0c677797f9f76a3db503bf";

export default node;
