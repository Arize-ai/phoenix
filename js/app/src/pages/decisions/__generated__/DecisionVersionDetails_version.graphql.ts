/**
 * @generated SignedSource<<860350c00c14a5f181291ccc85707707>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionVersionDetails_version$data = {
  readonly id: string;
  readonly metadata: any;
  readonly previousVersion: {
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionDetails_definition">;
  } | null;
  readonly tags: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionDetails_definition">;
  readonly " $fragmentType": "DecisionVersionDetails_version";
};
export type DecisionVersionDetails_version$key = {
  readonly " $data"?: DecisionVersionDetails_version$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionDetails_version">;
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
  "args": null,
  "kind": "FragmentSpread",
  "name": "DecisionVersionDetails_definition"
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionVersionDetails_version",
  "selections": [
    (v0/*:: as any*/),
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
      "concreteType": "DecisionVersionTag",
      "kind": "LinkedField",
      "name": "tags",
      "plural": true,
      "selections": [
        (v0/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    (v1/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionVersion",
      "kind": "LinkedField",
      "name": "previousVersion",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
        (v1/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "DecisionVersion",
  "abstractKey": null
};
})();

(node as any).hash = "42e56ebf0cb6426763633492ecd844ea";

export default node;
