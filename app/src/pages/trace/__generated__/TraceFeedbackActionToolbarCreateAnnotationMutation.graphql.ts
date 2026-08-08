/**
 * @generated SignedSource<<d5e8ebea65f12b26b9ba2f075d96ce85>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceFeedbackActionToolbarCreateAnnotationMutation$variables = {
  identifier: string;
  label: string;
  score: number;
  traceId: string;
};
export type TraceFeedbackActionToolbarCreateAnnotationMutation$data = {
  readonly createTraceAnnotations: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"TraceAnnotationSummaryGroup" | "TraceFeedbackActionToolbar_trace">;
      };
    };
  };
};
export type TraceFeedbackActionToolbarCreateAnnotationMutation = {
  response: TraceFeedbackActionToolbarCreateAnnotationMutation$data;
  variables: TraceFeedbackActionToolbarCreateAnnotationMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "identifier"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "label"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "score"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "traceId"
},
v4 = [
  {
    "items": [
      {
        "fields": [
          {
            "kind": "Literal",
            "name": "annotatorKind",
            "value": "HUMAN"
          },
          {
            "kind": "Variable",
            "name": "identifier",
            "variableName": "identifier"
          },
          {
            "kind": "Variable",
            "name": "label",
            "variableName": "label"
          },
          {
            "kind": "Literal",
            "name": "metadata",
            "value": {}
          },
          {
            "kind": "Literal",
            "name": "name",
            "value": "user_feedback"
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
          },
          {
            "kind": "Variable",
            "name": "traceId",
            "variableName": "traceId"
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
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "traceId"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
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
    "name": "TraceFeedbackActionToolbarCreateAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v4/*:: as any*/),
        "concreteType": "TraceAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createTraceAnnotations",
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
                "args": (v5/*:: as any*/),
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
                        "name": "TraceAnnotationSummaryGroup"
                      },
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "TraceFeedbackActionToolbar_trace"
                      }
                    ],
                    "type": "Trace",
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
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "TraceFeedbackActionToolbarCreateAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v4/*:: as any*/),
        "concreteType": "TraceAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createTraceAnnotations",
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
                "args": (v5/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v6/*:: as any*/),
                  (v7/*:: as any*/),
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
                          (v7/*:: as any*/),
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
                                      (v6/*:: as any*/),
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
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
                                          (v7/*:: as any*/),
                                          (v8/*:: as any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "optimizationDirection",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "CategoricalAnnotationValue",
                                            "kind": "LinkedField",
                                            "name": "values",
                                            "plural": true,
                                            "selections": [
                                              (v9/*:: as any*/),
                                              (v10/*:: as any*/)
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
                                          (v7/*:: as any*/)
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
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "TraceAnnotation",
                        "kind": "LinkedField",
                        "name": "traceAnnotations",
                        "plural": true,
                        "selections": [
                          (v7/*:: as any*/),
                          (v8/*:: as any*/),
                          (v9/*:: as any*/),
                          (v10/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "annotatorKind",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "createdAt",
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
                              (v7/*:: as any*/)
                            ],
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
                        "name": "traceAnnotationSummaries",
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
                              (v9/*:: as any*/)
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
                          (v8/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": "viewerUserFeedbackAnnotations",
                        "args": [
                          {
                            "kind": "Literal",
                            "name": "filter",
                            "value": {
                              "include": {
                                "names": [
                                  "user_feedback"
                                ]
                              }
                            }
                          }
                        ],
                        "concreteType": "TraceAnnotation",
                        "kind": "LinkedField",
                        "name": "traceAnnotations",
                        "plural": true,
                        "selections": [
                          (v7/*:: as any*/),
                          (v9/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "identifier",
                            "storageKey": null
                          }
                        ],
                        "storageKey": "traceAnnotations(filter:{\"include\":{\"names\":[\"user_feedback\"]}})"
                      }
                    ],
                    "type": "Trace",
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
    "cacheID": "d53d1b8ae65654afae430a4286385b33",
    "id": null,
    "metadata": {},
    "name": "TraceFeedbackActionToolbarCreateAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation TraceFeedbackActionToolbarCreateAnnotationMutation(\n  $traceId: ID!\n  $label: String!\n  $score: Float!\n  $identifier: String!\n) {\n  createTraceAnnotations(input: [{traceId: $traceId, name: \"user_feedback\", annotatorKind: HUMAN, label: $label, score: $score, metadata: {}, source: APP, identifier: $identifier}]) {\n    query {\n      node(id: $traceId) {\n        __typename\n        ... on Trace {\n          ...TraceAnnotationSummaryGroup\n          ...TraceFeedbackActionToolbar_trace\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment TraceAnnotationSummaryGroup on Trace {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  traceAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  traceAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment TraceFeedbackActionToolbar_trace on Trace {\n  id\n  viewerUserFeedbackAnnotations: traceAnnotations(filter: {include: {names: [\"user_feedback\"]}}) {\n    id\n    label\n    identifier\n  }\n}\n"
  }
};
})();

(node as any).hash = "e8b33490883ddc36d9c04063ca2d66f6";

export default node;
