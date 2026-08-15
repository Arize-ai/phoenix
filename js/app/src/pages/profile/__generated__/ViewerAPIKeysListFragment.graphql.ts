/**
 * @generated SignedSource<<024ed8f1723e9f6158103f60c729f87f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ViewerAPIKeysListFragment$data = {
  readonly apiKeys: ReadonlyArray<{
    readonly createdAt: string;
    readonly description: string | null;
    readonly expiresAt: string | null;
    readonly id: string;
    readonly name: string;
  }>;
  readonly id: string;
  readonly " $fragmentType": "ViewerAPIKeysListFragment";
};
export type ViewerAPIKeysListFragment$key = {
  readonly " $data"?: ViewerAPIKeysListFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ViewerAPIKeysListFragment">;
};

import ViewerAPIKeysListQuery_graphql from './ViewerAPIKeysListQuery.graphql';

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
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ViewerAPIKeysListQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ViewerAPIKeysListFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "UserApiKey",
      "kind": "LinkedField",
      "name": "apiKeys",
      "plural": true,
      "selections": [
        (v0/*:: as any*/),
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
          "name": "expiresAt",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    (v0/*:: as any*/)
  ],
  "type": "User",
  "abstractKey": null
};
})();

(node as any).hash = "3615fac8794059167646b247b4d851f1";

export default node;
