/**
 * @generated SignedSource<<a6b6e984b623b6088ef7e52d598b5f57>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { InlineFragment, ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type Routes_datasetMetadata$data = {
  readonly description: string | null;
  readonly name: string;
  readonly " $fragmentType": "Routes_datasetMetadata";
};
export type Routes_datasetMetadata$key = {
  readonly " $data"?: Routes_datasetMetadata$data;
  readonly " $fragmentSpreads": FragmentRefs<"Routes_datasetMetadata">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "Routes_datasetMetadata"
};

(node as any).hash = "505018a72dfca6c97977c33e06bcfe2d";

export default node;
