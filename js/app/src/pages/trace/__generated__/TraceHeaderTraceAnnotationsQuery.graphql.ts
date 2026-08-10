/**
 * @generated SignedSource<<fde1d7b5e70b0eedd566ed288cc41a2a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceHeaderTraceAnnotationsQuery$variables = {
  traceId: string;
};
export type TraceHeaderTraceAnnotationsQuery$data = {
  readonly trace: {
    readonly " $fragmentSpreads": FragmentRefs<"TraceHeaderTraceAnnotationsFragment">;
  };
};
export type TraceHeaderTraceAnnotationsQuery = {
  response: TraceHeaderTraceAnnotationsQuery$data;
  variables: TraceHeaderTraceAnnotationsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "traceId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "traceId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TraceHeaderTraceAnnotationsQuery",
    "selections": [
      {
        "alias": "trace",
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
                "args": null,
                "kind": "FragmentSpread",
                "name": "TraceHeaderTraceAnnotationsFragment"
              }
            ],
            "type": "Trace",
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
    "name": "TraceHeaderTraceAnnotationsQuery",
    "selections": [
      {
        "alias": "trace",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
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
                  {
                    "alias": null,
                    "args": [
                      {
                        "kind": "Literal",
                        "name": "first",
                        "value": 100
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
                              (v2/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v3/*:: as any*/),
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
                                  (v4/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CategoricalAnnotationValue",
                                    "kind": "LinkedField",
                                    "name": "values",
                                    "plural": true,
                                    "selections": [
                                      (v5/*:: as any*/),
                                      (v6/*:: as any*/)
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
                                  (v4/*:: as any*/),
                                  (v7/*:: as any*/),
                                  (v8/*:: as any*/)
                                ],
                                "type": "ContinuousAnnotationConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v4/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "threshold",
                                    "storageKey": null
                                  },
                                  (v7/*:: as any*/),
                                  (v8/*:: as any*/)
                                ],
                                "type": "FreeformAnnotationConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v9/*:: as any*/)
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
                    "storageKey": "annotationConfigs(first:100)"
                  },
                  (v9/*:: as any*/)
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
                  (v9/*:: as any*/),
                  (v3/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
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
                      (v5/*:: as any*/)
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
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Trace",
            "abstractKey": null
          },
          (v9/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "73e517636b57e6ef6d51a9addc6ef888",
    "id": null,
    "metadata": {},
    "name": "TraceHeaderTraceAnnotationsQuery",
    "operationKind": "query",
    "text": "query TraceHeaderTraceAnnotationsQuery(\n  $traceId: ID!\n) {\n  trace: node(id: $traceId) {\n    __typename\n    ... on Trace {\n      ...TraceHeaderTraceAnnotationsFragment\n    }\n    id\n  }\n}\n\nfragment ProjectAnnotationConfigFragment on Project {\n  annotationConfigs(first: 100) {\n    edges {\n      config: node {\n        __typename\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n          annotationType\n        }\n        ... on CategoricalAnnotationConfig {\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on FreeformAnnotationConfig {\n          optimizationDirection\n          threshold\n          lowerBound\n          upperBound\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment TraceAnnotationSummaryGroup on Trace {\n  traceAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  traceAnnotationSummaries {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment TraceHeaderTraceAnnotationsFragment on Trace {\n  project {\n    ...ProjectAnnotationConfigFragment\n    id\n  }\n  ...TraceAnnotationSummaryGroup\n}\n"
  }
};
})();

(node as any).hash = "8279883d8f80b70390552bb7875495f3";

export default node;
