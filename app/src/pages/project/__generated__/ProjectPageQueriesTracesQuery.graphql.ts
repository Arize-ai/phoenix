/**
 * @generated SignedSource<<0f8f24f83019583e278e80f25874a0e5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectPageQueriesTracesQuery$variables = {
  id: string;
  timeRange: TimeRange;
};
export type ProjectPageQueriesTracesQuery$data = {
  readonly project: {
    readonly " $fragmentSpreads": FragmentRefs<"TracesTable_spans">;
  };
};
export type ProjectPageQueriesTracesQuery = {
  response: ProjectPageQueriesTracesQuery$data;
  variables: ProjectPageQueriesTracesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 30
  },
  {
    "kind": "Literal",
    "name": "rootSpansOnly",
    "value": true
  },
  {
    "kind": "Literal",
    "name": "sort",
    "value": {
      "col": "startTime",
      "dir": "desc"
    }
  },
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v10 = [
  {
    "alias": "value",
    "args": null,
    "kind": "ScalarField",
    "name": "truncatedValue",
    "storageKey": null
  }
],
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v10/*: any*/),
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v10/*: any*/),
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanId",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanAnnotations",
  "plural": true,
  "selections": [
    (v3/*: any*/),
    (v4/*: any*/),
    (v15/*: any*/),
    (v16/*: any*/),
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
        (v3/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v18 = {
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
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "fraction",
          "storageKey": null
        },
        (v15/*: any*/)
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
    (v4/*: any*/)
  ],
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v3/*: any*/),
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
                (v2/*: any*/),
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
                    (v3/*: any*/),
                    (v4/*: any*/),
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
                        (v15/*: any*/),
                        (v16/*: any*/)
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
                    (v3/*: any*/)
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
v20 = {
  "alias": null,
  "args": null,
  "concreteType": "DocumentRetrievalMetrics",
  "kind": "LinkedField",
  "name": "documentRetrievalMetrics",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ndcg",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "precision",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hit",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageQueriesTracesQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "TracesTable_spans"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectPageQueriesTracesQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "spanAnnotationNames",
                "storageKey": null
              },
              {
                "alias": "rootSpans",
                "args": (v5/*: any*/),
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
                        "alias": "rootSpan",
                        "args": null,
                        "concreteType": "Span",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v6/*: any*/),
                          (v4/*: any*/),
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
                            "name": "statusCode",
                            "storageKey": null
                          },
                          (v7/*: any*/),
                          (v8/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "cumulativeTokenCountTotal",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "cumulativeTokenCountPrompt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "cumulativeTokenCountCompletion",
                            "storageKey": null
                          },
                          (v9/*: any*/),
                          (v11/*: any*/),
                          (v12/*: any*/),
                          (v13/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Trace",
                            "kind": "LinkedField",
                            "name": "trace",
                            "plural": false,
                            "selections": [
                              (v3/*: any*/),
                              (v14/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "numSpans",
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v17/*: any*/),
                          (v18/*: any*/),
                          (v19/*: any*/),
                          (v20/*: any*/),
                          {
                            "alias": null,
                            "args": [
                              {
                                "kind": "Literal",
                                "name": "first",
                                "value": 50
                              }
                            ],
                            "concreteType": "SpanConnection",
                            "kind": "LinkedField",
                            "name": "descendants",
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
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "Span",
                                    "kind": "LinkedField",
                                    "name": "node",
                                    "plural": false,
                                    "selections": [
                                      (v3/*: any*/),
                                      (v6/*: any*/),
                                      (v4/*: any*/),
                                      {
                                        "alias": "statusCode",
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "propagatedStatusCode",
                                        "storageKey": null
                                      },
                                      (v7/*: any*/),
                                      (v8/*: any*/),
                                      (v9/*: any*/),
                                      {
                                        "alias": "cumulativeTokenCountTotal",
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "tokenCountTotal",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": "cumulativeTokenCountPrompt",
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "tokenCountPrompt",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": "cumulativeTokenCountCompletion",
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "tokenCountCompletion",
                                        "storageKey": null
                                      },
                                      (v11/*: any*/),
                                      (v12/*: any*/),
                                      (v13/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "Trace",
                                        "kind": "LinkedField",
                                        "name": "trace",
                                        "plural": false,
                                        "selections": [
                                          (v3/*: any*/),
                                          (v14/*: any*/)
                                        ],
                                        "storageKey": null
                                      },
                                      (v17/*: any*/),
                                      (v19/*: any*/),
                                      (v18/*: any*/),
                                      (v20/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": "descendants(first:50)"
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
                          (v2/*: any*/),
                          (v3/*: any*/)
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
                "alias": "rootSpans",
                "args": (v5/*: any*/),
                "filters": [
                  "sort",
                  "rootSpansOnly",
                  "filterCondition",
                  "timeRange"
                ],
                "handle": "connection",
                "key": "TracesTable_rootSpans",
                "kind": "LinkedHandle",
                "name": "spans"
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7a73d5959eb5e180b54dce603c568e52",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQueriesTracesQuery",
    "operationKind": "query",
    "text": "query ProjectPageQueriesTracesQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $id) {\n    __typename\n    ...TracesTable_spans\n    id\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  spanAnnotationSummaries {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment SpanColumnSelector_annotations on Project {\n  spanAnnotationNames\n}\n\nfragment TraceHeaderRootSpanAnnotationsFragment on Span {\n  ...AnnotationSummaryGroup\n}\n\nfragment TracesTable_spans on Project {\n  name\n  ...SpanColumnSelector_annotations\n  rootSpans: spans(first: 30, sort: {col: startTime, dir: desc}, rootSpansOnly: true, timeRange: $timeRange) {\n    edges {\n      rootSpan: node {\n        id\n        spanKind\n        name\n        metadata\n        statusCode\n        startTime\n        latencyMs\n        cumulativeTokenCountTotal\n        cumulativeTokenCountPrompt\n        cumulativeTokenCountCompletion\n        parentId\n        input {\n          value: truncatedValue\n        }\n        output {\n          value: truncatedValue\n        }\n        spanId\n        trace {\n          id\n          traceId\n          numSpans\n        }\n        spanAnnotations {\n          id\n          name\n          label\n          score\n          annotatorKind\n          createdAt\n        }\n        spanAnnotationSummaries {\n          labelFractions {\n            fraction\n            label\n          }\n          meanScore\n          name\n        }\n        ...AnnotationSummaryGroup\n        documentRetrievalMetrics {\n          evaluationName\n          ndcg\n          precision\n          hit\n        }\n        descendants(first: 50) {\n          edges {\n            node {\n              id\n              spanKind\n              name\n              statusCode: propagatedStatusCode\n              startTime\n              latencyMs\n              parentId\n              cumulativeTokenCountTotal: tokenCountTotal\n              cumulativeTokenCountPrompt: tokenCountPrompt\n              cumulativeTokenCountCompletion: tokenCountCompletion\n              input {\n                value: truncatedValue\n              }\n              output {\n                value: truncatedValue\n              }\n              spanId\n              trace {\n                id\n                traceId\n              }\n              spanAnnotations {\n                id\n                name\n                label\n                score\n                annotatorKind\n                createdAt\n              }\n              ...AnnotationSummaryGroup\n              documentRetrievalMetrics {\n                evaluationName\n                ndcg\n                precision\n                hit\n              }\n              ...TraceHeaderRootSpanAnnotationsFragment\n            }\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "a11623d043c2945903dbd3fd179886cb";

export default node;
