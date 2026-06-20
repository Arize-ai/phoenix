/**
 * @generated SignedSource<<cc9faee1b95342adb65d2c5803ea5399>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceHeaderTraceAnnotationsFragment$data = {
  readonly " $fragmentSpreads": FragmentRefs<"TraceAnnotationSummaryGroup">;
  readonly " $fragmentType": "TraceHeaderTraceAnnotationsFragment";
};
export type TraceHeaderTraceAnnotationsFragment$key = {
  readonly " $data"?: TraceHeaderTraceAnnotationsFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"TraceHeaderTraceAnnotationsFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TraceHeaderTraceAnnotationsFragment",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "TraceAnnotationSummaryGroup"
    }
  ],
  "type": "Trace",
  "abstractKey": null
};

(node as any).hash = "21c430071ea0f24dbec39c57f4b73615";

export default node;
