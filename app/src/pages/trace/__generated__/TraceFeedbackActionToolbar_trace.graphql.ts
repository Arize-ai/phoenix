/**
 * @generated SignedSource<<0b681e996c447830a7f35596c018eb33>>
 * @lightSyntaxTransform
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

(node as any).hash = "3f52c62b0ee88fb6be09253ed8477ff4";

export default node;
