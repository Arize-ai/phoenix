/**
 * @generated SignedSource<<b1b902827b2fc8bc459878aaa0cf15a8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SettingsSecretsPageFragment$data = {
  readonly secrets: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly key: string;
        readonly updatedAt: string;
        readonly user: {
          readonly id: string;
          readonly profilePictureUrl: string | null;
          readonly username: string;
        } | null;
      };
    }>;
  };
  readonly " $fragmentType": "SettingsSecretsPageFragment";
};
export type SettingsSecretsPageFragment$key = {
  readonly " $data"?: SettingsSecretsPageFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"SettingsSecretsPageFragment">;
};

import SettingsSecretsPageRefetchQuery_graphql from './SettingsSecretsPageRefetchQuery.graphql';

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
      "fragmentPathInResult": [],
      "operation": SettingsSecretsPageRefetchQuery_graphql
    }
  },
  "name": "SettingsSecretsPageFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 100
        }
      ],
      "concreteType": "SecretConnection",
      "kind": "LinkedField",
      "name": "secrets",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SecretEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "Secret",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v0/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "key",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "updatedAt",
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
                    (v0/*: any*/),
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
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "secrets(first:100)"
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "f693b67c9e54bcd6885167d74099636c";

export default node;
