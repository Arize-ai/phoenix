/**
 * @generated SignedSource<<a009f4ab6b26396132ed4f18344a64ce>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionLabels$data = {
  readonly labels: ReadonlyArray<{
    readonly color: string | null;
    readonly name: string;
  }>;
  readonly " $fragmentType": "DecisionLabels";
};
export type DecisionLabels$key = {
  readonly " $data"?: DecisionLabels$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLabels">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionLabels",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": [
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
          "name": "color",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Decision",
  "abstractKey": null
};

(node as any).hash = "a46cc971507853e22adfab69c55ade9e";

export default node;
