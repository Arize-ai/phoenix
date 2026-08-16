/**
 * @generated SignedSource<<8072ed88b90e9e0149e344b5b6369a9f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceActionToolbarDeleteAnnotationMutation$variables = {
  annotationId: string;
  traceId: string;
};
export type TraceActionToolbarDeleteAnnotationMutation$data = {
  readonly deleteTraceAnnotations: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"TraceActionToolbar_trace" | "TraceAnnotationSummaryGroup">;
      };
    };
  };
};
export type TraceActionToolbarDeleteAnnotationMutation = {
  response: TraceActionToolbarDeleteAnnotationMutation$data;
  variables: TraceActionToolbarDeleteAnnotationMutation$variables;
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
  "name": "traceId"
},
v2 = [
  {
    "fields": [
      {
        "items": [
          {
            "kind": "Variable",
            "name": "annotationIds.0",
            "variableName": "annotationId"
          }
        ],
        "kind": "ListValue",
        "name": "annotationIds"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "traceId"
  }
],
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
  "name": "id",
  "storageKey": null
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
  "args": null,
  "kind": "ScalarField",
  "name": "score",
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
    "name": "TraceActionToolbarDeleteAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "TraceAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "deleteTraceAnnotations",
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
                "args": (v3/*:: as any*/),
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
                        "name": "TraceActionToolbar_trace"
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
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "TraceActionToolbarDeleteAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "TraceAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "deleteTraceAnnotations",
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
                "args": (v3/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
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
                          (v5/*:: as any*/),
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
                                          (v5/*:: as any*/),
                                          (v6/*:: as any*/),
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
                                              (v7/*:: as any*/),
                                              (v8/*:: as any*/)
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
                                          (v5/*:: as any*/)
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
                          (v5/*:: as any*/),
                          (v6/*:: as any*/),
                          (v7/*:: as any*/),
                          (v8/*:: as any*/),
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
                              (v5/*:: as any*/)
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
                              (v7/*:: as any*/)
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
                          (v6/*:: as any*/)
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
                          (v5/*:: as any*/),
                          (v7/*:: as any*/),
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
    "cacheID": "ad483918035d86524582dd30cc837e78",
    "id": null,
    "metadata": {},
    "name": "TraceActionToolbarDeleteAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation TraceActionToolbarDeleteAnnotationMutation(\n  $traceId: ID!\n  $annotationId: ID!\n) {\n  deleteTraceAnnotations(input: {annotationIds: [$annotationId]}) {\n    query {\n      node(id: $traceId) {\n        __typename\n        ... on Trace {\n          ...TraceAnnotationSummaryGroup\n          ...TraceActionToolbar_trace\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment TraceActionToolbar_trace on Trace {\n  id\n  viewerUserFeedbackAnnotations: traceAnnotations(filter: {include: {names: [\"user_feedback\"]}}) {\n    id\n    label\n    identifier\n  }\n}\n\nfragment TraceAnnotationSummaryGroup on Trace {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  traceAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  traceAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "cb9f88e0750df069b3308c7e0764897c";

export default node;
