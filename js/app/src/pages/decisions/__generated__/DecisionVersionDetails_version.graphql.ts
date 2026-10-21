/**
 * @generated SignedSource<<d0f144edb435c6cc0ea32dc53d72f37c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionVersionDetails_version$data = {
  readonly createdAt: string;
  readonly description: string | null;
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
  readonly user: {
    readonly profilePictureUrl: string | null;
    readonly username: string;
  } | null;
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
      "name": "description",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
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
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "user",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "username",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "profilePictureUrl",
          "storageKey": null
        }
      ],
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

(node as any).hash = "ba3e8075ad8ceb87e96c03f458369923";

export default node;
