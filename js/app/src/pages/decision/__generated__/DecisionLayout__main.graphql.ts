/**
 * @generated SignedSource<<d1f62a8b45530a8eb377f86a41259ecf>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionLayout__main$data = {
  readonly description: string | null;
  readonly id: string;
  readonly metadata: any;
  readonly name: string;
  readonly sourceDecision: {
    readonly id: string;
    readonly name: string;
  } | null;
  readonly versionCount: number;
  readonly " $fragmentType": "DecisionLayout__main";
};
export type DecisionLayout__main$key = {
  readonly " $data"?: DecisionLayout__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLayout__main">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionLayout__main",
  "selections": [
    (v0/*:: as any*/),
    (v1/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "description",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "metadata",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "versionCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Decision",
      "kind": "LinkedField",
      "name": "sourceDecision",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
        (v1/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Decision",
  "abstractKey": null
};
})();

(node as any).hash = "740a4e0c1a6cd46979b6f46546148203";

export default node;
