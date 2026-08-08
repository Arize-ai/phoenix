/**
 * @generated SignedSource<<be7328bdca311e3ddd23ff18f2899ce0>>
 * @lightSyntaxTransform
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
        readonly value: {
          readonly __typename: "DecryptedSecret";
          readonly value: string;
        } | {
          readonly __typename: "UnparsableSecret";
          readonly parseError: string;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        };
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
var v0 = [
  "secrets"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": 100,
      "kind": "LocalArgument",
      "name": "count"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "cursor"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "count",
        "cursor": "cursor",
        "direction": "forward",
        "path": (v0/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "count",
          "cursor": "cursor"
        },
        "backward": null,
        "path": (v0/*:: as any*/)
      },
      "fragmentPathInResult": [],
      "operation": SettingsSecretsPageRefetchQuery_graphql
    }
  },
  "name": "SettingsSecretsPageFragment",
  "selections": [
    {
      "alias": "secrets",
      "args": null,
      "concreteType": "SecretConnection",
      "kind": "LinkedField",
      "name": "__SettingsSecretsPage_secrets_connection",
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
                (v1/*:: as any*/),
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
                    (v1/*:: as any*/),
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
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "value",
                  "plural": false,
                  "selections": [
                    (v2/*:: as any*/),
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "value",
                          "storageKey": null
                        }
                      ],
                      "type": "DecryptedSecret",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "parseError",
                          "storageKey": null
                        }
                      ],
                      "type": "UnparsableSecret",
                      "abstractKey": null
                    }
                  ],
                  "storageKey": null
                },
                (v2/*:: as any*/)
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "ba94b1a73c531646ae5ab82eb48878c7";

export default node;
