/**
 * @generated SignedSource<<6886b4d92785e8809d52a90318a9187a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceActionToolbar_trace$data = {
  readonly id: string;
  readonly viewerUserFeedbackAnnotations: ReadonlyArray<{
    readonly id: string;
    readonly identifier: string;
    readonly label: string | null;
  }>;
  readonly " $fragmentType": "TraceActionToolbar_trace";
};
export type TraceActionToolbar_trace$key = {
  readonly " $data"?: TraceActionToolbar_trace$data;
  readonly " $fragmentSpreads": FragmentRefs<"TraceActionToolbar_trace">;
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
  "name": "TraceActionToolbar_trace",
  "selections": [
    (v0/*:: as any*/),
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
        (v0/*:: as any*/),
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
      "storageKey": "traceAnnotations(filter:{\"include\":{\"names\":[\"user_feedback\"]}})"
    }
  ],
  "type": "Trace",
  "abstractKey": null
};
})();

(node as any).hash = "c2758036b9849684415d4aebc6f98e63";

export default node;
