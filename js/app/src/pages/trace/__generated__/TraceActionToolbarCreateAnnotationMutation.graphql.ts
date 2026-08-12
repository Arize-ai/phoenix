/**
 * @generated SignedSource<<6065b68e53ab3b7b825120c470961829>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceActionToolbarCreateAnnotationMutation$variables = {
  identifier: string;
  label: string;
  score: number;
  traceId: string;
};
export type TraceActionToolbarCreateAnnotationMutation$data = {
  readonly createTraceAnnotations: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"TraceActionToolbar_trace" | "TraceAnnotationSummaryGroup">;
      };
    };
  };
};
export type TraceActionToolbarCreateAnnotationMutation = {
  response: TraceActionToolbarCreateAnnotationMutation$data;
  variables: TraceActionToolbarCreateAnnotationMutation$variables;
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
  "name": "id",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
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
    "name": "TraceActionToolbarCreateAnnotationMutation",
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
      (v3/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "TraceActionToolbarCreateAnnotationMutation",
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
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  (v6/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "TraceAnnotation",
                        "kind": "LinkedField",
                        "name": "traceAnnotations",
                        "plural": true,
                        "selections": [
                          (v6/*:: as any*/),
                          (v7/*:: as any*/),
                          (v8/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "score",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "explanation",
                            "storageKey": null
                          },
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
                              (v6/*:: as any*/)
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
                          (v7/*:: as any*/)
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
                          (v6/*:: as any*/),
                          (v8/*:: as any*/),
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
    "cacheID": "e930e331e071dc0e4a2fd43b280bb134",
    "id": null,
    "metadata": {},
    "name": "TraceActionToolbarCreateAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation TraceActionToolbarCreateAnnotationMutation(\n  $traceId: ID!\n  $label: String!\n  $score: Float!\n  $identifier: String!\n) {\n  createTraceAnnotations(input: [{traceId: $traceId, name: \"user_feedback\", annotatorKind: HUMAN, label: $label, score: $score, metadata: {}, source: APP, identifier: $identifier}]) {\n    query {\n      node(id: $traceId) {\n        __typename\n        ... on Trace {\n          ...TraceAnnotationSummaryGroup\n          ...TraceActionToolbar_trace\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment TraceActionToolbar_trace on Trace {\n  id\n  viewerUserFeedbackAnnotations: traceAnnotations(filter: {include: {names: [\"user_feedback\"]}}) {\n    id\n    label\n    identifier\n  }\n}\n\nfragment TraceAnnotationSummaryGroup on Trace {\n  traceAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  traceAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "ab9203265391045efa174a27a8483977";

export default node;
