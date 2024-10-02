/**
 * @generated SignedSource<<749d6270534ccf205568b2479a5e3ead>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanColumnSelector_annotations$data = {
  readonly spanAnnotationNames: ReadonlyArray<string>;
  readonly " $fragmentType": "SpanColumnSelector_annotations";
};
export type SpanColumnSelector_annotations$key = {
  readonly " $data"?: SpanColumnSelector_annotations$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanColumnSelector_annotations">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SpanColumnSelector_annotations",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanAnnotationNames",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "ad01e6897ad1ea779eb346d85783b8b4";

export default node;
