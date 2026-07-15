/**
 * @generated SignedSource<<a88d13a67dedfc3ae18b36bc2bdcd3ba>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type MimeType = "json" | "text";
import { FragmentRefs } from "relay-runtime";
export type SessionDetailsTraceList_traces$data = {
  readonly id: string;
  readonly numTraces: number;
  readonly traces: {
    readonly edges: ReadonlyArray<{
      readonly trace: {
        readonly id: string;
        readonly rootSpan: {
          readonly attributes: string;
          readonly cumulativeTokenCountTotal: number | null;
          readonly endTime: string | null;
          readonly id: string;
          readonly input: {
            readonly mimeType: MimeType;
            readonly truncatedValue: string;
            readonly value: string;
          } | null;
          readonly latencyMs: number | null;
          readonly name: string;
          readonly output: {
            readonly mimeType: MimeType;
            readonly truncatedValue: string;
            readonly value: string;
          } | null;
          readonly project: {
            readonly id: string;
          };
          readonly spanId: string;
          readonly startTime: string;
          readonly trace: {
            readonly costSummary: {
              readonly total: {
                readonly cost: number | null;
              };
            };
            readonly id: string;
            readonly " $fragmentSpreads": FragmentRefs<"TraceAnnotationSummaryGroup" | "TraceFeedbackActionToolbar_trace">;
          };
          readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup">;
        } | null;
        readonly traceId: string;
      };
    }>;
  };
  readonly " $fragmentType": "SessionDetailsTraceList_traces";
};
export type SessionDetailsTraceList_traces$key = {
  readonly " $data"?: SessionDetailsTraceList_traces$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionDetailsTraceList_traces">;
};

import SessionDetailsTraceListRefetchQuery_graphql from './SessionDetailsTraceListRefetchQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "traces"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "truncatedValue",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mimeType",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 50,
      "kind": "LocalArgument",
      "name": "first"
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
      "operation": SessionDetailsTraceListRefetchQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "SessionDetailsTraceList_traces",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "numTraces",
      "storageKey": null
    },
    {
      "alias": "traces",
      "args": null,
      "concreteType": "TraceConnection",
      "kind": "LinkedField",
      "name": "__SessionDetailsTraceList_traces_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "TraceEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "trace",
              "args": null,
              "concreteType": "Trace",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "traceId",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Span",
                  "kind": "LinkedField",
                  "name": "rootSpan",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "Trace",
                      "kind": "LinkedField",
                      "name": "trace",
                      "plural": false,
                      "selections": [
                        (v1/*:: as any*/),
                        {
                          "args": null,
                          "kind": "FragmentSpread",
                          "name": "TraceAnnotationSummaryGroup"
                        },
                        {
                          "args": null,
                          "kind": "FragmentSpread",
                          "name": "TraceFeedbackActionToolbar_trace"
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
                        }
                      ],
                      "storageKey": null
                    },
                    (v1/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "name",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "attributes",
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
                        (v1/*:: as any*/)
                      ],
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "SpanIOValue",
                      "kind": "LinkedField",
                      "name": "input",
                      "plural": false,
                      "selections": (v2/*:: as any*/),
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "SpanIOValue",
                      "kind": "LinkedField",
                      "name": "output",
                      "plural": false,
                      "selections": (v2/*:: as any*/),
                      "storageKey": null
                    },
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
                      "name": "latencyMs",
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
                      "name": "spanId",
                      "storageKey": null
                    },
                    {
                      "args": null,
                      "kind": "FragmentSpread",
                      "name": "AnnotationSummaryGroup"
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
              "concreteType": "Trace",
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
    (v1/*:: as any*/)
  ],
  "type": "ProjectSession",
  "abstractKey": null
};
})();

(node as any).hash = "f4fcbc5d46909736db5a9388eabe7617";

export default node;
