/**
 * @generated SignedSource<<288de4e0ae930aec2042df9b1ff847f4>>
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

(node as any).hash = "6cde9ca22bfc99084304e3e817be01dc";

export default node;
