/**
 * @generated SignedSource<<b26f6c6da25e46b62ea40269e85c9635>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceFeedbackActionToolbar_trace$data = {
  readonly id: string;
  readonly viewerUserFeedbackAnnotations: ReadonlyArray<{
    readonly id: string;
    readonly identifier: string;
    readonly label: string | null;
  }>;
  readonly " $fragmentType": "TraceFeedbackActionToolbar_trace";
};
export type TraceFeedbackActionToolbar_trace$key = {
  readonly " $data"?: TraceFeedbackActionToolbar_trace$data;
  readonly " $fragmentSpreads": FragmentRefs<"TraceFeedbackActionToolbar_trace">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TraceFeedbackActionToolbar_trace",
  "selections": [
    (v0/*: any*/),
    {
      "alias": "viewerUserFeedbackAnnotations",
      "args": [
        {
          "kind": "Literal",
          "name": "filter",
          "value": {
            "include": {
              "names": [
                "user_feedback"
              ],
              "sources": [
                "APP"
              ]
            }
          }
        }
      ],
      "concreteType": "TraceAnnotation",
      "kind": "LinkedField",
      "name": "traceAnnotations",
      "plural": true,
      "selections": [
        (v0/*: any*/),
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
          "name": "identifier",
          "storageKey": null
        }
      ],
      "storageKey": "traceAnnotations(filter:{\"include\":{\"names\":[\"user_feedback\"],\"sources\":[\"APP\"]}})"
    }
  ],
  "type": "Trace",
  "abstractKey": null
};
})();

(node as any).hash = "0c5d87b67c12b6ded73afbec9333176f";

export default node;
