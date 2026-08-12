/**
 * @generated SignedSource<<f4fc844cd9046b03463a5f7d35415427>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
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
          readonly createdAt: string;
          readonly explanation: string | null;
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
        readonly userId: string | null;
        readonly " $fragmentSpreads": FragmentRefs<"SessionAnnotationSummaryGroup">;
      };
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"ProjectAnnotationMetricsConfigFragment" | "SessionColumnSelector_annotations">;
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
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = [
  {
    "alias": "value",
    "args": null,
    "kind": "ScalarField",
    "name": "truncatedValue",
    "storageKey": null
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
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
      "defaultValue": 30,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "sessionFilterCondition"
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
        "path": (v0/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*:: as any*/)
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
    (v1/*:: as any*/),
    (v2/*:: as any*/),
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ProjectAnnotationMetricsConfigFragment"
    },
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
          "name": "sessionFilterCondition",
          "variableName": "sessionFilterCondition"
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
                (v1/*:: as any*/),
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
                  "name": "userId",
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
                  "selections": (v3/*:: as any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "SpanIOValue",
                  "kind": "LinkedField",
                  "name": "lastOutput",
                  "plural": false,
                  "selections": (v3/*:: as any*/),
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
                    (v1/*:: as any*/),
                    (v2/*:: as any*/),
                    (v4/*:: as any*/),
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
                        (v4/*:: as any*/)
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
                    (v2/*:: as any*/)
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
    }
  ],
  "type": "Project",
  "abstractKey": null
};
})();

(node as any).hash = "8bb998a55d17befc2a3f9f7ec64ade0b";

export default node;
