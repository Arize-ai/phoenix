/**
 * @generated SignedSource<<52afe7632e6b78947c6d87fa501276bc>>
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
  readonly userFeedbackAnnotations: ReadonlyArray<{
    readonly id: string;
    readonly label: string | null;
    readonly name: string;
    readonly user: {
      readonly id: string;
    } | null;
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
      "alias": "userFeedbackAnnotations",
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
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        },
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
          "concreteType": "User",
          "kind": "LinkedField",
          "name": "user",
          "plural": false,
          "selections": [
            (v0/*: any*/)
          ],
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

(node as any).hash = "08ea2a0a48588efd8bb65e5386e8c7de";

export default node;
