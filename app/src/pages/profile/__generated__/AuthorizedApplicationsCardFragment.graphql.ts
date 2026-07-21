/**
 * @generated SignedSource<<d6fe40032cff07222de650c4e42c3786>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AuthorizedApplicationsCardFragment$data = {
  readonly id: string;
  readonly oauth2Grants: ReadonlyArray<{
    readonly clientId: string;
    readonly clientName: string;
    readonly createdAt: string;
    readonly expiresAt: string | null;
    readonly id: string;
    readonly isFirstParty: boolean;
    readonly lastUsedAt: string | null;
    readonly scopes: ReadonlyArray<string>;
  }>;
  readonly " $fragmentType": "AuthorizedApplicationsCardFragment";
};
export type AuthorizedApplicationsCardFragment$key = {
  readonly " $data"?: AuthorizedApplicationsCardFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"AuthorizedApplicationsCardFragment">;
};

import AuthorizedApplicationsCardQuery_graphql from './AuthorizedApplicationsCardQuery.graphql';

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
      "operation": AuthorizedApplicationsCardQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "AuthorizedApplicationsCardFragment",
  "selections": [
    (v0/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "OAuth2Grant",
      "kind": "LinkedField",
      "name": "oauth2Grants",
      "plural": true,
      "selections": [
        (v0/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "clientName",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "clientId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "isFirstParty",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "scopes",
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "lastUsedAt",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};
})();

(node as any).hash = "38f9e9e768ac7af283995fb1258ad34c";

export default node;
