/**
 * @generated SignedSource<<ab4f3d6d8fbfb9e93e0ff9468eefabb7>>
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
export type SpansTable_spans$data = {
  readonly id: string;
  readonly name: string;
  readonly spans: {
    readonly edges: ReadonlyArray<{
      readonly span: {
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
        readonly metadata: string | null;
        readonly name: string;
        readonly output: {
          readonly value: string;
        } | null;
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
        readonly tokenCountCompletion: number | null;
        readonly tokenCountPrompt: number | null;
        readonly tokenCountTotal: number | null;
        readonly trace: {
          readonly id: string;
          readonly traceId: string;
        };
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup">;
      };
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"SpanColumnSelector_annotations">;
  readonly " $fragmentType": "SpansTable_spans";
};
export type SpansTable_spans$key = {
  readonly " $data"?: SpansTable_spans$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpansTable_spans">;
};

import SpansTableSpansQuery_graphql from './SpansTableSpansQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "spans"
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
      "kind": "RootArgument",
      "name": "orphanSpanAsRootSpan"
    },
    {
      "defaultValue": true,
      "kind": "LocalArgument",
      "name": "rootSpansOnly"
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
      "operation": SpansTableSpansQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "SpansTable_spans",
  "selections": [
    (v1/*: any*/),
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "SpanColumnSelector_annotations"
    },
    {
      "alias": "spans",
      "args": [
        {
          "kind": "Variable",
          "name": "filterCondition",
          "variableName": "filterCondition"
        },
        {
          "kind": "Variable",
          "name": "orphanSpanAsRootSpan",
          "variableName": "orphanSpanAsRootSpan"
        },
        {
          "kind": "Variable",
          "name": "rootSpansOnly",
          "variableName": "rootSpansOnly"
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
      "name": "__SpansTable_spans_connection",
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
                (v2/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "spanKind",
                  "storageKey": null
                },
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
                  "kind": "ScalarField",
                  "name": "tokenCountPrompt",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "tokenCountCompletion",
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
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "spanId",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Trace",
                  "kind": "LinkedField",
                  "name": "trace",
                  "plural": false,
                  "selections": [
                    (v2/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "traceId",
                      "storageKey": null
                    }
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
                  "selections": (v3/*: any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "SpanIOValue",
                  "kind": "LinkedField",
                  "name": "output",
                  "plural": false,
                  "selections": (v3/*: any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "SpanAnnotation",
                  "kind": "LinkedField",
                  "name": "spanAnnotations",
                  "plural": true,
                  "selections": [
                    (v2/*: any*/),
                    (v1/*: any*/),
                    (v4/*: any*/),
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
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "AnnotationSummaryGroup"
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

(node as any).hash = "1128552e9dfc766aa37c1acec4a9807f";

export default node;
