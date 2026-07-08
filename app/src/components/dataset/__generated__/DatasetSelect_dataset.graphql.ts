/**
 * @generated SignedSource<<10b8acfcbaaa1a153c35ece7fd816392>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetSelect_dataset$data = {
  readonly exampleCount: number;
  readonly id: string;
  readonly labels: ReadonlyArray<{
    readonly color: string;
    readonly id: string;
    readonly name: string;
  }>;
  readonly name: string;
  readonly " $fragmentType": "DatasetSelect_dataset";
};
export type DatasetSelect_dataset$key = {
  readonly " $data"?: DatasetSelect_dataset$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetSelect_dataset">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "DatasetSelect_dataset"
};

(node as any).hash = "e5a0b1650426283637ea59a109398aa9";

export default node;
