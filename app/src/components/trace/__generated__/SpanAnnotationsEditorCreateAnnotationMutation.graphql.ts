/**
 * @generated SignedSource<<54d3be3a6dae8ff4114b7be4470ea08c>>
 * @lightSyntaxTransform
 * @nogrep
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
  metadata?: any;
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
  filterUserIds?: ReadonlyArray<string> | null;
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
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup" | "SpanAnnotationsEditor_spanAnnotations" | "SpanAsideAnnotationList_span" | "SpanFeedback_annotations" | "TraceHeaderRootSpanAnnotationsFragment">;
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
v10 = [
  {
    "kind": "Variable",
    "name": "filterUserIds",
    "variableName": "filterUserIds"
  }
],
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v12 = {
  "kind": "TypeDiscriminator",
  "abstractKey": "__isNode"
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationType",
  "storageKey": null
},
v15 = {
  "kind": "InlineFragment",
  "selections": [
    (v14/*: any*/)
  ],
  "type": "AnnotationConfigBase",
  "abstractKey": "__isAnnotationConfigBase"
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
  "name": "name",
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
  "concreteType": "CategoricalAnnotationValue",
  "kind": "LinkedField",
  "name": "values",
  "plural": true,
  "selections": [
    (v18/*: any*/),
    (v19/*: any*/)
  ],
  "storageKey": null
},
v21 = {
  "kind": "InlineFragment",
  "selections": [
    (v13/*: any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "fraction",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanAnnotationsEditorCreateAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v6/*: any*/),
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
                "args": (v7/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "args": (v8/*: any*/),
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
                "args": (v9/*: any*/),
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
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "TraceHeaderRootSpanAnnotationsFragment"
                      },
                      {
                        "args": (v10/*: any*/),
                        "kind": "FragmentSpread",
                        "name": "SpanAnnotationsEditor_spanAnnotations"
                      },
                      {
                        "args": (v10/*: any*/),
                        "kind": "FragmentSpread",
                        "name": "SpanAsideAnnotationList_span"
                      },
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "SpanFeedback_annotations"
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
      (v2/*: any*/),
      (v1/*: any*/),
      (v4/*: any*/),
      (v0/*: any*/),
      (v5/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Operation",
    "name": "SpanAnnotationsEditorCreateAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v6/*: any*/),
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
                "args": (v7/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v11/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
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
                                  (v11/*: any*/),
                                  (v15/*: any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v14/*: any*/),
                                      (v13/*: any*/),
                                      (v16/*: any*/),
                                      (v17/*: any*/),
                                      (v20/*: any*/)
                                    ],
                                    "type": "CategoricalAnnotationConfig",
                                    "abstractKey": null
                                  },
                                  (v21/*: any*/)
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
                        "args": (v8/*: any*/),
                        "concreteType": "AnnotationSummary",
                        "kind": "LinkedField",
                        "name": "spanAnnotationSummary",
                        "plural": false,
                        "selections": [
                          (v17/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "LabelFraction",
                            "kind": "LinkedField",
                            "name": "labelFractions",
                            "plural": true,
                            "selections": [
                              (v18/*: any*/),
                              (v22/*: any*/)
                            ],
                            "storageKey": null
                          },
                          (v23/*: any*/)
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
                "args": (v9/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v11/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Project",
                        "kind": "LinkedField",
                        "name": "project",
                        "plural": false,
                        "selections": [
                          (v13/*: any*/),
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
                                      (v11/*: any*/),
                                      (v15/*: any*/),
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          (v13/*: any*/),
                                          (v17/*: any*/),
                                          (v16/*: any*/),
                                          (v20/*: any*/)
                                        ],
                                        "type": "CategoricalAnnotationConfig",
                                        "abstractKey": null
                                      },
                                      (v21/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": "configs",
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
                                      (v11/*: any*/),
                                      (v21/*: any*/),
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          (v17/*: any*/)
                                        ],
                                        "type": "AnnotationConfigBase",
                                        "abstractKey": "__isAnnotationConfigBase"
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
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SpanAnnotation",
                        "kind": "LinkedField",
                        "name": "spanAnnotations",
                        "plural": true,
                        "selections": [
                          (v13/*: any*/),
                          (v17/*: any*/),
                          (v18/*: any*/),
                          (v19/*: any*/),
                          (v24/*: any*/),
                          (v25/*: any*/),
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
                              (v13/*: any*/)
                            ],
                            "storageKey": null
                          },
                          (v26/*: any*/),
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
                            "concreteType": "LabelFraction",
                            "kind": "LinkedField",
                            "name": "labelFractions",
                            "plural": true,
                            "selections": [
                              (v22/*: any*/),
                              (v18/*: any*/)
                            ],
                            "storageKey": null
                          },
                          (v23/*: any*/),
                          (v17/*: any*/)
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
                          (v13/*: any*/),
                          (v17/*: any*/),
                          (v24/*: any*/),
                          (v19/*: any*/),
                          (v18/*: any*/),
                          (v26/*: any*/),
                          (v25/*: any*/)
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
    "cacheID": "65e5cacd2385efab168446e14c9b001f",
    "id": null,
    "metadata": {},
    "name": "SpanAnnotationsEditorCreateAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation SpanAnnotationsEditorCreateAnnotationMutation(\n  $name: String!\n  $input: CreateSpanAnnotationInput!\n  $spanId: GlobalID!\n  $filterUserIds: [GlobalID!]\n  $timeRange: TimeRange!\n  $projectId: GlobalID!\n) {\n  createSpanAnnotations(input: [$input]) {\n    query {\n      project: node(id: $projectId) {\n        __typename\n        ... on Project {\n          ...AnnotationSummaryValueFragment_20r1YH\n        }\n        __isNode: __typename\n        id\n      }\n      node(id: $spanId) {\n        __typename\n        ... on Span {\n          ...AnnotationSummaryGroup\n          ...TraceHeaderRootSpanAnnotationsFragment\n          ...SpanAnnotationsEditor_spanAnnotations_3lpqY\n          ...SpanAsideAnnotationList_span_3lpqY\n          ...SpanFeedback_annotations\n        }\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n    }\n  }\n  spanAnnotationSummaries {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment AnnotationSummaryValueFragment_20r1YH on Project {\n  annotationConfigs {\n    edges {\n      node {\n        __typename\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          annotationType\n        }\n        ... on CategoricalAnnotationConfig {\n          annotationType\n          id\n          optimizationDirection\n          name\n          values {\n            label\n            score\n          }\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n  spanAnnotationSummary(annotationName: $name, timeRange: $timeRange) {\n    name\n    labelFractions {\n      label\n      fraction\n    }\n    meanScore\n  }\n  id\n}\n\nfragment SpanAnnotationsEditor_spanAnnotations_3lpqY on Span {\n  id\n  filteredSpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}, include: {userIds: $filterUserIds}}) {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n    createdAt\n  }\n}\n\nfragment SpanAsideAnnotationList_span_3lpqY on Span {\n  project {\n    id\n    annotationConfigs {\n      configs: edges {\n        config: node {\n          __typename\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            name\n          }\n        }\n      }\n    }\n  }\n  filteredSpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}, include: {userIds: $filterUserIds}}) {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n    createdAt\n  }\n}\n\nfragment SpanFeedback_annotations on Span {\n  id\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    metadata\n    annotatorKind\n    identifier\n    source\n    createdAt\n    updatedAt\n    user {\n      id\n      username\n      profilePictureUrl\n    }\n  }\n}\n\nfragment TraceHeaderRootSpanAnnotationsFragment on Span {\n  ...AnnotationSummaryGroup\n}\n"
  }
};
})();

(node as any).hash = "27cc772a18065a99d76f4711e254530f";

export default node;
