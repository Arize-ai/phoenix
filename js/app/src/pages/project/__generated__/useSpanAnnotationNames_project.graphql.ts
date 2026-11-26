/**
 * @generated SignedSource<<619af493ed06704d82cb91721d3dd843>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type useSpanAnnotationNames_project$data = {
  readonly id: string;
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

(node as any).hash = "2dcbc6fe2d5500382d125885cf614dcc";

export default node;
