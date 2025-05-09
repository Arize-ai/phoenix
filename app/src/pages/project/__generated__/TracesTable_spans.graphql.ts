/**
 * @generated SignedSource<<4bfbdd258cc30acda2c9ccd3467c71c4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type SpanKind = "agent" | "chain" | "embedding" | "evaluator" | "guardrail" | "llm" | "reranker" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
import { FragmentRefs } from "relay-runtime";
export type TracesTable_spans$data = {
  readonly id: string;
  readonly name: string;
  readonly rootSpans: {
    readonly edges: ReadonlyArray<{
      readonly rootSpan: {
        readonly cumulativeTokenCountCompletion: number | null;
        readonly cumulativeTokenCountPrompt: number | null;
        readonly cumulativeTokenCountTotal: number | null;
        readonly descendants: {
          readonly edges: ReadonlyArray<{
            readonly node: {
              readonly cumulativeTokenCountCompletion: number | null;
              readonly cumulativeTokenCountPrompt: number | null;
              readonly cumulativeTokenCountTotal: number | null;
              readonly documentRetrievalMetrics: ReadonlyArray<{
                readonly evaluationName: string;
                readonly hit: number | null;
                readonly ndcg: number | null;
                readonly precision: number | null;
              }>;
              readonly id: string;
              readonly input: {
                readonly value: string;
              } | null;
              readonly latencyMs: number | null;
              readonly name: string;
              readonly output: {
                readonly value: string;
              } | null;
              readonly parentId: string | null;
              readonly spanAnnotations: ReadonlyArray<{
                readonly annotatorKind: AnnotatorKind;
                readonly createdAt: string;
                readonly id: string;
                readonly label: string | null;
                readonly name: string;
                readonly score: number | null;
              }>;
              readonly spanId: string;
              readonly spanKind: SpanKind;
              readonly startTime: string;
              readonly statusCode: SpanStatusCode;
              readonly trace: {
                readonly id: string;
                readonly traceId: string;
              };
              readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup" | "TraceHeaderRootSpanAnnotationsFragment">;
            };
          }>;
        };
        readonly documentRetrievalMetrics: ReadonlyArray<{
          readonly evaluationName: string;
          readonly hit: number | null;
          readonly ndcg: number | null;
          readonly precision: number | null;
        }>;
        readonly id: string;
        readonly input: {
          readonly value: string;
        } | null;
        readonly latencyMs: number | null;
        readonly metadata: string | null;
        readonly name: string;
        readonly output: {
          readonly value: string;
        } | null;
        readonly parentId: string | null;
        readonly spanAnnotationSummaries: ReadonlyArray<{
          readonly labelFractions: ReadonlyArray<{
            readonly fraction: number;
            readonly label: string;
          }>;
          readonly meanScore: number | null;
          readonly name: string;
        }>;
        readonly spanAnnotations: ReadonlyArray<{
          readonly annotatorKind: AnnotatorKind;
          readonly createdAt: string;
          readonly id: string;
          readonly label: string | null;
          readonly name: string;
          readonly score: number | null;
        }>;
        readonly spanId: string;
        readonly spanKind: SpanKind;
        readonly startTime: string;
        readonly statusCode: SpanStatusCode;
        readonly trace: {
          readonly id: string;
          readonly numSpans: number;
          readonly traceId: string;
        };
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup">;
      };
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"SpanColumnSelector_annotations">;
  readonly " $fragmentType": "TracesTable_spans";
};
export type TracesTable_spans$key = {
  readonly " $data"?: TracesTable_spans$data;
  readonly " $fragmentSpreads": FragmentRefs<"TracesTable_spans">;
};

import TracesTableQuery_graphql from './TracesTableQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "rootSpans"
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
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v7 = [
  {
    "alias": "value",
    "args": null,
    "kind": "ScalarField",
    "name": "truncatedValue",
    "storageKey": null
  }
],
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v7/*: any*/),
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v7/*: any*/),
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanId",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
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
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanAnnotations",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    (v1/*: any*/),
    (v12/*: any*/),
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
      "name": "annotatorKind",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v14 = {
  "args": null,
  "kind": "FragmentSpread",
  "name": "AnnotationSummaryGroup"
},
v15 = {
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
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filterCondition"
    },
    {
      "defaultValue": 30,
      "kind": "LocalArgument",
      "name": "first"
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
      "operation": TracesTableQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "TracesTable_spans",
  "selections": [
    (v1/*: any*/),
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "SpanColumnSelector_annotations"
    },
    {
      "alias": "rootSpans",
      "args": [
        {
          "kind": "Variable",
          "name": "filterCondition",
          "variableName": "filterCondition"
        },
        {
          "kind": "Literal",
          "name": "rootSpansOnly",
          "value": true
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
      "concreteType": "SpanConnection",
      "kind": "LinkedField",
      "name": "__TracesTable_rootSpans_connection",
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
                (v2/*: any*/),
                (v3/*: any*/),
                (v1/*: any*/),
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
                (v4/*: any*/),
                (v5/*: any*/),
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
                (v6/*: any*/),
                (v8/*: any*/),
                (v9/*: any*/),
                (v10/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Trace",
                  "kind": "LinkedField",
                  "name": "trace",
                  "plural": false,
                  "selections": [
                    (v2/*: any*/),
                    (v11/*: any*/),
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
                (v13/*: any*/),
                {
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
                        (v12/*: any*/)
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
                (v14/*: any*/),
                (v15/*: any*/),
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
                            (v2/*: any*/),
                            (v3/*: any*/),
                            (v1/*: any*/),
                            {
                              "alias": "statusCode",
                              "args": null,
                              "kind": "ScalarField",
                              "name": "propagatedStatusCode",
                              "storageKey": null
                            },
                            (v4/*: any*/),
                            (v5/*: any*/),
                            (v6/*: any*/),
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
                            (v8/*: any*/),
                            (v9/*: any*/),
                            (v10/*: any*/),
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "Trace",
                              "kind": "LinkedField",
                              "name": "trace",
                              "plural": false,
                              "selections": [
                                (v2/*: any*/),
                                (v11/*: any*/)
                              ],
                              "storageKey": null
                            },
                            (v13/*: any*/),
                            (v14/*: any*/),
                            (v15/*: any*/),
                            {
                              "args": null,
                              "kind": "FragmentSpread",
                              "name": "TraceHeaderRootSpanAnnotationsFragment"
                            }
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

(node as any).hash = "506e7c2397918ad76b8f1a50a0a2c49b";

export default node;
