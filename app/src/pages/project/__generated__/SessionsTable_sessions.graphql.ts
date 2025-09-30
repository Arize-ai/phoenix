/**
 * @generated SignedSource<<8725c611cf9dbbd996db0d301dcc672b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type SessionsTable_sessions$data = {
  readonly id: string;
  readonly name: string;
  readonly sessions: {
    readonly edges: ReadonlyArray<{
      readonly session: {
        readonly costSummary: {
          readonly total: {
            readonly cost: number | null;
          };
        };
        readonly endTime: string;
        readonly firstInput: {
          readonly value: string;
        } | null;
        readonly id: string;
        readonly lastOutput: {
          readonly value: string;
        } | null;
        readonly numTraces: number;
        readonly project: {
          readonly annotationConfigs: {
            readonly edges: ReadonlyArray<{
              readonly node: {
                readonly annotationType?: AnnotationType;
                readonly id?: string;
                readonly name?: string;
                readonly optimizationDirection?: OptimizationDirection;
                readonly values?: ReadonlyArray<{
                  readonly label: string;
                  readonly score: number | null;
                }>;
              };
            }>;
          };
          readonly id: string;
        };
        readonly sessionAnnotationSummaries: ReadonlyArray<{
          readonly labelFractions: ReadonlyArray<{
            readonly fraction: number;
            readonly label: string;
          }>;
          readonly meanScore: number | null;
          readonly name: string;
        }>;
        readonly sessionAnnotations: ReadonlyArray<{
          readonly annotatorKind: AnnotatorKind;
          readonly id: string;
          readonly label: string | null;
          readonly name: string;
          readonly score: number | null;
          readonly user: {
            readonly profilePictureUrl: string | null;
            readonly username: string;
          } | null;
        }>;
        readonly sessionId: string;
        readonly startTime: string;
        readonly tokenUsage: {
          readonly total: number;
        };
        readonly traceLatencyMsP50: number | null;
        readonly traceLatencyMsP99: number | null;
        readonly " $fragmentSpreads": FragmentRefs<"SessionAnnotationSummaryGroup">;
      };
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"SessionColumnSelector_annotations">;
  readonly " $fragmentType": "SessionsTable_sessions";
};
export type SessionsTable_sessions$key = {
  readonly " $data"?: SessionsTable_sessions$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionsTable_sessions">;
};

import SessionsTableQuery_graphql from './SessionsTableQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "sessions"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filterIoSubstring"
    },
    {
      "defaultValue": 30,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "sessionId"
    },
    {
      "defaultValue": {
        "col": "startTime",
        "dir": "desc"
      },
      "kind": "LocalArgument",
      "name": "sort"
    },
    {
      "kind": "RootArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [
        "node"
      ],
      "operation": SessionsTableQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "SessionsTable_sessions",
  "selections": [
    (v1/*: any*/),
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "SessionColumnSelector_annotations"
    },
    {
      "alias": "sessions",
      "args": [
        {
          "kind": "Variable",
          "name": "filterIoSubstring",
          "variableName": "filterIoSubstring"
        },
        {
          "kind": "Variable",
          "name": "sessionId",
          "variableName": "sessionId"
        },
        {
          "kind": "Variable",
          "name": "sort",
          "variableName": "sort"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "ProjectSessionConnection",
      "kind": "LinkedField",
      "name": "__SessionsTable_sessions_connection",
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
                (v2/*: any*/),
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
                  "selections": (v3/*: any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "SpanIOValue",
                  "kind": "LinkedField",
                  "name": "lastOutput",
                  "plural": false,
                  "selections": (v3/*: any*/),
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
                    (v2/*: any*/),
                    (v1/*: any*/),
                    (v4/*: any*/),
                    (v5/*: any*/),
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
                        (v4/*: any*/)
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
                    (v1/*: any*/)
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
                    (v2/*: any*/),
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
                                    (v2/*: any*/),
                                    (v1/*: any*/),
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
                                        (v4/*: any*/),
                                        (v5/*: any*/)
                                      ],
                                      "storageKey": null
                                    }
                                  ],
                                  "type": "CategoricalAnnotationConfig",
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
                  "storageKey": null
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "SessionAnnotationSummaryGroup"
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
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
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
    (v2/*: any*/)
  ],
  "type": "Project",
  "abstractKey": null
};
})();

(node as any).hash = "5b3f781dd578f1b1198e7de5a5daf95d";

export default node;
