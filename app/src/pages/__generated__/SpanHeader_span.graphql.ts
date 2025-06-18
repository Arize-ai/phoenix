/**
 * @generated SignedSource<<3c3f8abb69cb56fc1d550454a0d5058b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type SpanKind = "agent" | "chain" | "embedding" | "evaluator" | "guardrail" | "llm" | "reranker" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
import { FragmentRefs } from "relay-runtime";
export type SpanHeader_span$data = {
  readonly code: SpanStatusCode;
  readonly cost: {
    readonly totalCost: number | null;
  } | null;
  readonly id: string;
  readonly latencyMs: number | null;
  readonly name: string;
  readonly spanKind: SpanKind;
  readonly startTime: string;
  readonly tokenCountTotal: number | null;
  readonly " $fragmentType": "SpanHeader_span";
};
export type SpanHeader_span$key = {
  readonly " $data"?: SpanHeader_span$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanHeader_span">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SpanHeader_span",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
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
      "name": "spanKind",
      "storageKey": null
    },
    {
      "alias": "code",
      "args": null,
      "kind": "ScalarField",
      "name": "statusCode",
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
      "name": "tokenCountTotal",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanCost",
      "kind": "LinkedField",
      "name": "cost",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "totalCost",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};

(node as any).hash = "4c5e3f7c761f8f2c836c83a5f151b3b2";

export default node;
