/**
 * @generated SignedSource<<83be7d6ab866a7cef7e205e1192553aa>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanAnnotationsEditorEditAnnotationMutation$variables = {
  annotationId: string;
  explanation?: string | null;
  label?: string | null;
  name: string;
  score?: number | null;
  spanId: string;
};
export type SpanAnnotationsEditorEditAnnotationMutation$data = {
  readonly patchSpanAnnotations: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"SpanAnnotationsEditor_spanAnnotations" | "SpanAsideAnnotationList_span" | "SpanFeedback_annotations">;
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
  "name": "label"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "score"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "spanId"
},
v6 = [
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
  "names": [
    "note"
  ]
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
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
  "name": "explanation",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
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
    "name": "SpanAnnotationsEditorEditAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v6/*: any*/),
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
                "alias": null,
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
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "SpanAnnotationsEditor_spanAnnotations"
                      },
                      {
                        "args": null,
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
      (v5/*: any*/),
      (v0/*: any*/),
      (v3/*: any*/),
      (v2/*: any*/),
      (v4/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "SpanAnnotationsEditorEditAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v6/*: any*/),
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
                "alias": null,
                "args": (v7/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v8/*: any*/),
                  {
                    "kind": "TypeDiscriminator",
                    "abstractKey": "__isNode"
                  },
                  (v9/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": "filteredSpanAnnotations",
                        "args": [
                          {
                            "fields": [
                              {
                                "kind": "Literal",
                                "name": "exclude",
                                "value": (v10/*: any*/)
                              },
                              {
                                "fields": [
                                  {
                                    "kind": "Literal",
                                    "name": "userIds",
                                    "value": null
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
                          (v9/*: any*/),
                          (v11/*: any*/),
                          (v12/*: any*/),
                          (v13/*: any*/),
                          (v14/*: any*/),
                          (v15/*: any*/),
                          (v16/*: any*/)
                        ],
                        "storageKey": "spanAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]},\"include\":{\"userIds\":null}})"
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Project",
                        "kind": "LinkedField",
                        "name": "project",
                        "plural": false,
                        "selections": [
                          (v9/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "AnnotationConfigConnection",
                            "kind": "LinkedField",
                            "name": "annotationConfigs",
                            "plural": false,
                            "selections": [
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
                                      (v8/*: any*/),
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          (v9/*: any*/)
                                        ],
                                        "type": "Node",
                                        "abstractKey": "__isNode"
                                      },
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          (v11/*: any*/)
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
                        "alias": "spanAnnotationsWithoutNotes",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "filter",
                            "value": {
                              "exclude": (v10/*: any*/)
                            }
                          }
                        ],
                        "concreteType": "SpanAnnotation",
                        "kind": "LinkedField",
                        "name": "spanAnnotations",
                        "plural": true,
                        "selections": [
                          (v9/*: any*/),
                          (v11/*: any*/),
                          (v14/*: any*/),
                          (v12/*: any*/),
                          (v13/*: any*/)
                        ],
                        "storageKey": "spanAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SpanAnnotation",
                        "kind": "LinkedField",
                        "name": "spanAnnotations",
                        "plural": true,
                        "selections": [
                          (v9/*: any*/),
                          (v11/*: any*/),
                          (v14/*: any*/),
                          (v13/*: any*/),
                          (v15/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "metadata",
                            "storageKey": null
                          },
                          (v12/*: any*/),
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
                          (v16/*: any*/),
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
                              (v9/*: any*/),
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
    "cacheID": "222f0509e850d88d279043451cb3999d",
    "id": null,
    "metadata": {},
    "name": "SpanAnnotationsEditorEditAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation SpanAnnotationsEditorEditAnnotationMutation(\n  $spanId: GlobalID!\n  $annotationId: GlobalID!\n  $name: String!\n  $label: String\n  $score: Float\n  $explanation: String\n) {\n  patchSpanAnnotations(input: [{annotationId: $annotationId, name: $name, label: $label, score: $score, explanation: $explanation, annotatorKind: HUMAN}]) {\n    query {\n      node(id: $spanId) {\n        __typename\n        ... on Span {\n          ...SpanAnnotationsEditor_spanAnnotations\n          ...SpanAsideAnnotationList_span\n          ...SpanFeedback_annotations\n        }\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n\nfragment SpanAnnotationsEditor_spanAnnotations on Span {\n  id\n  filteredSpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}, include: {}}) {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n    createdAt\n  }\n}\n\nfragment SpanAsideAnnotationList_span on Span {\n  project {\n    id\n    annotationConfigs {\n      configs: edges {\n        config: node {\n          __typename\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            name\n          }\n        }\n      }\n    }\n  }\n  spanAnnotationsWithoutNotes: spanAnnotations(filter: {exclude: {names: [\"note\"]}}) {\n    id\n    name\n    label\n    annotatorKind\n    score\n  }\n}\n\nfragment SpanFeedback_annotations on Span {\n  id\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    metadata\n    annotatorKind\n    identifier\n    source\n    createdAt\n    updatedAt\n    user {\n      id\n      username\n      profilePictureUrl\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "46f137b0ab616a60b22a398f28221dcc";

export default node;
