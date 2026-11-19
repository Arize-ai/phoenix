/**
 * @generated SignedSource<<755cdc4300f09a0673cfe3e223e00381>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type useSpanAnnotationNames_project$data = {
  readonly spanAnnotationNames: ReadonlyArray<string>;
  readonly traceAnnotationNames: ReadonlyArray<string>;
  readonly " $fragmentType": "useSpanAnnotationNames_project";
};
export type useSpanAnnotationNames_project$key = {
  readonly " $data"?: useSpanAnnotationNames_project$data;
  readonly " $fragmentSpreads": FragmentRefs<"useSpanAnnotationNames_project">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "useSpanAnnotationNames_project"
};

(node as any).hash = "78b6c1c3363a3ad82ac39d0f2aec775c";

export default node;
