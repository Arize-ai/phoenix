/**
 * @generated SignedSource<<b66f08ac7a6a601414157e2b6a5025fb>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionDetailsQuery$variables = {
  id: string;
};
export type SessionDetailsQuery$data = {
  readonly session: {
    readonly costSummary?: {
      readonly completion: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
      readonly prompt: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
      readonly total: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    };
    readonly latencyP50?: number | null;
    readonly numTraces?: number;
    readonly project?: {
      readonly id: string;
    };
    readonly sessionId?: string;
    readonly tokenUsage?: {
      readonly total: number;
    };
    readonly " $fragmentSpreads": FragmentRefs<"SessionAnnotationSummaryGroup">;
  };
};
export type SessionDetailsQuery = {
  response: SessionDetailsQuery$data;
  variables: SessionDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  (v2/*:: as any*/)
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numTraces",
  "storageKey": null
},
v5 = {
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
v6 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "tokens",
    "storageKey": null
  }
],
v7 = {
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
      "selections": (v6/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "prompt",
      "plural": false,
      "selections": (v6/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v6/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionId",
  "storageKey": null
},
v9 = {
  "alias": "latencyP50",
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
  "name": "name",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionDetailsQuery",
    "selections": [
      {
        "alias": "session",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
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
                "selections": (v3/*:: as any*/),
                "storageKey": null
              },
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SessionAnnotationSummaryGroup"
              }
            ],
            "type": "ProjectSession",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SessionDetailsQuery",
    "selections": [
      {
        "alias": "session",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v10/*:: as any*/),
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
                  (v2/*:: as any*/),
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
                              (v10/*:: as any*/),
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
                                  (v2/*:: as any*/),
                                  (v11/*:: as any*/),
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
                                      (v12/*:: as any*/),
                                      (v13/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "CategoricalAnnotationConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": (v3/*:: as any*/),
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
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ProjectSessionAnnotation",
                "kind": "LinkedField",
                "name": "sessionAnnotations",
                "plural": true,
                "selections": [
                  (v2/*:: as any*/),
                  (v11/*:: as any*/),
                  (v12/*:: as any*/),
                  (v13/*:: as any*/),
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
                      (v2/*:: as any*/)
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
                "name": "sessionAnnotationSummaries",
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
                      (v12/*:: as any*/)
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
                  (v11/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "ProjectSession",
            "abstractKey": null
          },
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "dccf246ffac306f660c3172363c92fdd",
    "id": null,
    "metadata": {},
    "name": "SessionDetailsQuery",
    "operationKind": "query",
    "text": "query SessionDetailsQuery(\n  $id: ID!\n) {\n  session: node(id: $id) {\n    __typename\n    ... on ProjectSession {\n      project {\n        id\n      }\n      numTraces\n      tokenUsage {\n        total\n      }\n      costSummary {\n        total {\n          cost\n          tokens\n        }\n        prompt {\n          cost\n          tokens\n        }\n        completion {\n          cost\n          tokens\n        }\n      }\n      sessionId\n      latencyP50: traceLatencyMsQuantile(probability: 0.5)\n      ...SessionAnnotationSummaryGroup\n    }\n    id\n  }\n}\n\nfragment SessionAnnotationSummaryGroup on ProjectSession {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  sessionAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  sessionAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "9fc3d94d356ae61f74c6b46740c9ac36";

export default node;
