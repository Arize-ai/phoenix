/**
 * @generated SignedSource<<e43b0b754199fc33dd1718bef246be76>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ConnectedTraceTreeQuery$variables = {
  count?: number | null;
  cursor?: string | null;
  id: string;
};
export type ConnectedTraceTreeQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"ConnectedTraceTree">;
  };
};
export type ConnectedTraceTreeQuery = {
  response: ConnectedTraceTreeQuery$data;
  variables: ConnectedTraceTreeQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": 1000,
    "kind": "LocalArgument",
    "name": "count"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "cursor"
  },
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
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "kind": "Literal",
  "name": "first",
  "value": 100
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
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
  "name": "lowerBound",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v10 = [
  (v2/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v5/*:: as any*/),
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
          (v6/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "CategoricalAnnotationValue",
            "kind": "LinkedField",
            "name": "values",
            "plural": true,
            "selections": [
              (v7/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "score",
                "storageKey": null
              }
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
          (v6/*:: as any*/),
          (v8/*:: as any*/),
          (v9/*:: as any*/)
        ],
        "type": "ContinuousAnnotationConfig",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v6/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "threshold",
            "storageKey": null
          },
          (v8/*:: as any*/),
          (v9/*:: as any*/)
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
      (v3/*:: as any*/)
    ],
    "type": "Node",
    "abstractKey": "__isNode"
  }
],
v11 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "cursor"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "count"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ConnectedTraceTreeQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": [
              {
                "kind": "Variable",
                "name": "count",
                "variableName": "count"
              },
              {
                "kind": "Variable",
                "name": "cursor",
                "variableName": "cursor"
              }
            ],
            "kind": "FragmentSpread",
            "name": "ConnectedTraceTree"
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
    "name": "ConnectedTraceTreeQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "numSpans",
                "storageKey": null
              },
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
                        "fields": [
                          {
                            "kind": "Literal",
                            "name": "annotationNames",
                            "value": null
                          }
                        ],
                        "kind": "ObjectValue",
                        "name": "filter"
                      },
                      (v4/*:: as any*/)
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
                              (v5/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "evaluator",
                                "plural": false,
                                "selections": [
                                  (v2/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "outputConfigs",
                                    "plural": true,
                                    "selections": (v10/*:: as any*/),
                                    "storageKey": null
                                  },
                                  (v3/*:: as any*/)
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
                    ],
                    "storageKey": "evaluators(filter:{\"annotationNames\":null},first:100)"
                  },
                  {
                    "alias": "configsByName",
                    "args": [
                      (v4/*:: as any*/)
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
                            "selections": (v10/*:: as any*/),
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": "annotationConfigs(first:100)"
                  },
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v11/*:: as any*/),
                "concreteType": "SpanConnection",
                "kind": "LinkedField",
                "name": "spans",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SpanEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "span",
                        "args": null,
                        "concreteType": "Span",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "spanId",
                            "storageKey": null
                          },
                          (v5/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "spanKind",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "statusCode",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "startTime",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "endTime",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "parentId",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "latencyMs",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "tokenCountTotal",
                            "storageKey": null
                          },
                          {
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
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "cost",
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
                              {
                                "kind": "Literal",
                                "name": "filter",
                                "value": {
                                  "exclude": {
                                    "names": [
                                      "note"
                                    ]
                                  }
                                }
                              }
                            ],
                            "concreteType": "AnnotationSummary",
                            "kind": "LinkedField",
                            "name": "spanAnnotationSummaries",
                            "plural": true,
                            "selections": [
                              (v5/*:: as any*/),
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
                                "name": "meanScore",
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
                              }
                            ],
                            "storageKey": "spanAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "cursor",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Span",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v2/*:: as any*/),
                          (v3/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PageInfo",
                    "kind": "LinkedField",
                    "name": "pageInfo",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "endCursor",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "hasNextPage",
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
                "filters": null,
                "handle": "connection",
                "key": "ConnectedTraceTree_spans",
                "kind": "LinkedHandle",
                "name": "spans"
              }
            ],
            "type": "Trace",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "828884501f50f753c34a266ef9cc5cdc",
    "id": null,
    "metadata": {},
    "name": "ConnectedTraceTreeQuery",
    "operationKind": "query",
    "text": "query ConnectedTraceTreeQuery(\n  $count: Int = 1000\n  $cursor: String = null\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...ConnectedTraceTree_1G22uz\n    id\n  }\n}\n\nfragment ConnectedTraceTree_1G22uz on Trace {\n  numSpans\n  project {\n    ...ProjectAnnotationConfigsByNameFragment\n    id\n  }\n  spans(first: $count, after: $cursor) {\n    edges {\n      span: node {\n        id\n        spanId\n        name\n        spanKind\n        statusCode\n        startTime\n        endTime\n        parentId\n        latencyMs\n        tokenCountTotal\n        costSummary {\n          total {\n            cost\n          }\n        }\n        spanAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n          name\n          count\n          meanScore\n          labelFractions {\n            fraction\n            label\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment ProjectAnnotationConfigsByNameFragment on Project {\n  evaluators(first: 100, filter: {}) {\n    edges {\n      node {\n        name\n        evaluator {\n          __typename\n          outputConfigs {\n            __typename\n            ...useProjectAnnotationConfigsByName_config\n            ... on Node {\n              __isNode: __typename\n              id\n            }\n          }\n          id\n        }\n        id\n      }\n    }\n  }\n  configsByName: annotationConfigs(first: 100) {\n    edges {\n      config: node {\n        __typename\n        ...useProjectAnnotationConfigsByName_config\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment useProjectAnnotationConfigsByName_config on AnnotationConfigBase {\n  __isAnnotationConfigBase: __typename\n  name\n  annotationType\n  ... on CategoricalAnnotationConfig {\n    optimizationDirection\n    values {\n      label\n      score\n    }\n  }\n  ... on ContinuousAnnotationConfig {\n    optimizationDirection\n    lowerBound\n    upperBound\n  }\n  ... on FreeformAnnotationConfig {\n    optimizationDirection\n    threshold\n    lowerBound\n    upperBound\n  }\n}\n"
  }
};
})();

(node as any).hash = "7f91cb9e2eae85cd9f94e7d82e5cedab";

export default node;
