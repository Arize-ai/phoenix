/**
 * @generated SignedSource<<82404c4648cab0654a599034f98506fe>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotatorKind = "HUMAN" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type SpanFeedback_annotations$data = {
  readonly spanAnnotations: ReadonlyArray<{
    readonly annotatorKind: AnnotatorKind;
    readonly explanation: string | null;
    readonly id: string;
    readonly label: string | null;
    readonly metadata: any;
    readonly name: string;
    readonly score: number | null;
  }>;
  readonly " $fragmentType": "SpanFeedback_annotations";
};
export type SpanFeedback_annotations$key = {
  readonly " $data"?: SpanFeedback_annotations$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanFeedback_annotations">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SpanFeedback_annotations",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanAnnotation",
      "kind": "LinkedField",
      "name": "spanAnnotations",
      "plural": true,
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
        },
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
          "name": "annotatorKind",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};

(node as any).hash = "24bc78a9b98c345bac80f7e3d0652963";

export default node;
