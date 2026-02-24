/**
 * @generated SignedSource<<08fd4dbe127fe1a836c5d08148b20acd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceHeaderRootSpanAnnotationsFragment$data = {
  readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup">;
  readonly " $fragmentType": "TraceHeaderRootSpanAnnotationsFragment";
};
export type TraceHeaderRootSpanAnnotationsFragment$key = {
  readonly " $data"?: TraceHeaderRootSpanAnnotationsFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"TraceHeaderRootSpanAnnotationsFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TraceHeaderRootSpanAnnotationsFragment",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "AnnotationSummaryGroup"
    }
  ],
  "type": "Span",
  "abstractKey": null
};

(node as any).hash = "1926def8a20ce2131c00ccd01efe9fb6";

export default node;
