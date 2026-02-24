/**
 * @generated SignedSource<<2147f680c1c36ceb17f74eeb3898a736>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectSessionAnnoAttr = "label" | "score";
export type ProjectSessionColumn = "costTotal" | "endTime" | "numTraces" | "startTime" | "tokenCountTotal";
export type SortDir = "asc" | "desc";
export type ProjectSessionSort = {
  annoResultKey?: ProjectSessionAnnoResultKey | null;
  col?: ProjectSessionColumn | null;
  dir: SortDir;
};
export type ProjectSessionAnnoResultKey = {
  attr: ProjectSessionAnnoAttr;
  name: string;
};
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type SessionsTableQuery$variables = {
  after?: string | null;
  filterIoSubstring?: string | null;
  first?: number | null;
  id: string;
  sessionId?: string | null;
  sort?: ProjectSessionSort | null;
  timeRange?: TimeRange | null;
};
export type SessionsTableQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"SessionsTable_sessions">;
  };
};
export type SessionsTableQuery = {
  response: SessionsTableQuery$data;
  variables: SessionsTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "after"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterIoSubstring"
},
v2 = {
  "defaultValue": 30,
  "kind": "LocalArgument",
  "name": "first"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sessionId"
},
v5 = {
  "defaultValue": {
    "col": "startTime",
    "dir": "desc"
  },
  "kind": "LocalArgument",
  "name": "sort"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v7 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v8 = {
  "kind": "Variable",
  "name": "after",
  "variableName": "after"
},
v9 = {
  "kind": "Variable",
  "name": "filterIoSubstring",
  "variableName": "filterIoSubstring"
},
v10 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v11 = {
  "kind": "Variable",
  "name": "sessionId",
  "variableName": "sessionId"
},
v12 = {
  "kind": "Variable",
  "name": "sort",
  "variableName": "sort"
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v16 = [
  (v8/*: any*/),
  (v9/*: any*/),
  (v10/*: any*/),
  (v11/*: any*/),
  (v12/*: any*/),
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v17 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  }
],
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
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionsTableQuery",
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
            "args": [
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/)
            ],
            "kind": "FragmentSpread",
            "name": "SessionsTable_sessions"
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Operation",
    "name": "SessionsTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v7/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v13/*: any*/),
          (v14/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v15/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "sessionAnnotationNames",
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v16/*: any*/),
                "concreteType": "ProjectSessionConnection",
                "kind": "LinkedField",
                "name": "sessions",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ProjectSessionEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "session",
                        "args": null,
                        "concreteType": "ProjectSession",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v14/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "sessionId",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "numTraces",
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
                            "concreteType": "SpanIOValue",
                            "kind": "LinkedField",
                            "name": "firstInput",
                            "plural": false,
                            "selections": (v17/*: any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SpanIOValue",
                            "kind": "LinkedField",
                            "name": "lastOutput",
                            "plural": false,
                            "selections": (v17/*: any*/),
                            "storageKey": null
                          },
                          {
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
                          {
                            "alias": "traceLatencyMsP50",
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
                          {
                            "alias": "traceLatencyMsP99",
                            "args": [
                              {
                                "kind": "Literal",
                                "name": "probability",
                                "value": 0.99
                              }
                            ],
                            "kind": "ScalarField",
                            "name": "traceLatencyMsQuantile",
                            "storageKey": "traceLatencyMsQuantile(probability:0.99)"
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
                            "args": null,
                            "concreteType": "ProjectSessionAnnotation",
                            "kind": "LinkedField",
                            "name": "sessionAnnotations",
                            "plural": true,
                            "selections": [
                              (v14/*: any*/),
                              (v15/*: any*/),
                              (v18/*: any*/),
                              (v19/*: any*/),
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
                                  (v14/*: any*/)
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
                                  (v18/*: any*/)
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
                              (v15/*: any*/)
                            ],
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
                              (v14/*: any*/),
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
                                          (v13/*: any*/),
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
                                              (v14/*: any*/),
                                              (v15/*: any*/),
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
                                                  (v18/*: any*/),
                                                  (v19/*: any*/)
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
                                              (v14/*: any*/)
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
                        "concreteType": "ProjectSession",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v13/*: any*/),
                          (v14/*: any*/)
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
                "args": (v16/*: any*/),
                "filters": [
                  "sort",
                  "filterIoSubstring",
                  "timeRange",
                  "sessionId"
                ],
                "handle": "connection",
                "key": "SessionsTable_sessions",
                "kind": "LinkedHandle",
                "name": "sessions"
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
    "cacheID": "60c8994f30bf52decf0058d7f3ec3647",
    "id": null,
    "metadata": {},
    "name": "SessionsTableQuery",
    "operationKind": "query",
    "text": "query SessionsTableQuery(\n  $after: String = null\n  $filterIoSubstring: String = null\n  $first: Int = 30\n  $sessionId: String = null\n  $sort: ProjectSessionSort = {col: startTime, dir: desc}\n  $timeRange: TimeRange\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...SessionsTable_sessions_371pAD\n    id\n  }\n}\n\nfragment SessionAnnotationSummaryGroup on ProjectSession {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  sessionAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  sessionAnnotationSummaries {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment SessionColumnSelector_annotations on Project {\n  sessionAnnotationNames\n}\n\nfragment SessionsTable_sessions_371pAD on Project {\n  name\n  ...SessionColumnSelector_annotations\n  sessions(first: $first, after: $after, sort: $sort, filterIoSubstring: $filterIoSubstring, timeRange: $timeRange, sessionId: $sessionId) {\n    edges {\n      session: node {\n        id\n        sessionId\n        numTraces\n        startTime\n        endTime\n        firstInput {\n          value\n        }\n        lastOutput {\n          value\n        }\n        tokenUsage {\n          total\n        }\n        traceLatencyMsP50: traceLatencyMsQuantile(probability: 0.5)\n        traceLatencyMsP99: traceLatencyMsQuantile(probability: 0.99)\n        costSummary {\n          total {\n            cost\n          }\n        }\n        sessionAnnotations {\n          id\n          name\n          label\n          score\n          annotatorKind\n          user {\n            username\n            profilePictureUrl\n            id\n          }\n        }\n        sessionAnnotationSummaries {\n          labelFractions {\n            fraction\n            label\n          }\n          meanScore\n          name\n        }\n        project {\n          id\n          annotationConfigs {\n            edges {\n              node {\n                __typename\n                ... on AnnotationConfigBase {\n                  __isAnnotationConfigBase: __typename\n                  annotationType\n                }\n                ... on CategoricalAnnotationConfig {\n                  id\n                  name\n                  optimizationDirection\n                  values {\n                    label\n                    score\n                  }\n                }\n                ... on Node {\n                  __isNode: __typename\n                  id\n                }\n              }\n            }\n          }\n        }\n        ...SessionAnnotationSummaryGroup\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "5b3f781dd578f1b1198e7de5a5daf95d";

export default node;
