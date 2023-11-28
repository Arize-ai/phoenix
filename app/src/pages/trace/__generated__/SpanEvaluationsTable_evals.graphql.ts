/**
 * @generated SignedSource<<e77ba2889b0c61f477b637cf201977de>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanEvaluationsTable_evals$data = {
  readonly spanEvaluations: ReadonlyArray<{
    readonly explanation: string | null;
    readonly label: string | null;
    readonly name: string;
    readonly score: number | null;
  }>;
  readonly " $fragmentType": "SpanEvaluationsTable_evals";
};
export type SpanEvaluationsTable_evals$key = {
  readonly " $data"?: SpanEvaluationsTable_evals$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanEvaluationsTable_evals">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SpanEvaluationsTable_evals",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanEvaluation",
      "kind": "LinkedField",
      "name": "spanEvaluations",
      "plural": true,
      "selections": [
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
          "name": "label",
          "storageKey": null
        },
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};

(node as any).hash = "0604d02236eeb7e73817a68e2e6f12e2";

export default node;
