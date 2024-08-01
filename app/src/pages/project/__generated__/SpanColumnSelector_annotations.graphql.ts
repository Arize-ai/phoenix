/**
 * @generated SignedSource<<2957a55fe97962ace0f1ac8fb466e632>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
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
