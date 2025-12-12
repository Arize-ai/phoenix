/**
 * @generated SignedSource<<0b8937929737cdfe2a651d70d366138e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CustomProvidersCardQuery$variables = {
  after?: string | null;
  first?: number | null;
};
export type CustomProvidersCardQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"CustomProvidersCard_data">;
};
export type CustomProvidersCardQuery = {
  response: CustomProvidersCardQuery$data;
  variables: CustomProvidersCardQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": 50,
    "kind": "LocalArgument",
    "name": "first"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
  {
    "alias": null,
    "args": null,
    "concreteType": null,
    "kind": "LinkedField",
    "name": "config",
    "plural": false,
    "selections": [
      (v2/*: any*/),
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
        "type": "UnparsableConfig",
        "abstractKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CustomProvidersCardQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "CustomProvidersCard_data"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CustomProvidersCardQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "GenerativeModelCustomProviderConnection",
        "kind": "LinkedField",
        "name": "generativeModelCustomProviders",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "GenerativeModelCustomProviderEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
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
                    "name": "sdk",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "provider",
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
                      (v3/*: any*/),
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
                    "kind": "InlineFragment",
                    "selections": (v4/*: any*/),
                    "type": "GenerativeModelCustomProviderOpenAI",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": (v4/*: any*/),
                    "type": "GenerativeModelCustomProviderAzureOpenAI",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": (v4/*: any*/),
                    "type": "GenerativeModelCustomProviderAnthropic",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": (v4/*: any*/),
                    "type": "GenerativeModelCustomProviderAWSBedrock",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": (v4/*: any*/),
                    "type": "GenerativeModelCustomProviderGoogleGenAI",
                    "abstractKey": null
                  }
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
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "filters": null,
        "handle": "connection",
        "key": "CustomProvidersCard_generativeModelCustomProviders",
        "kind": "LinkedHandle",
        "name": "generativeModelCustomProviders"
      }
    ]
  },
  "params": {
    "cacheID": "73b4785849ab614c23d8a7b7db874222",
    "id": null,
    "metadata": {},
    "name": "CustomProvidersCardQuery",
    "operationKind": "query",
    "text": "query CustomProvidersCardQuery(\n  $after: String = null\n  $first: Int = 50\n) {\n  ...CustomProvidersCard_data_2HEEH6\n}\n\nfragment CustomProvidersCard_data_2HEEH6 on Query {\n  generativeModelCustomProviders(first: $first, after: $after) {\n    edges {\n      node {\n        __typename\n        id\n        name\n        description\n        sdk\n        provider\n        createdAt\n        updatedAt\n        user {\n          id\n          username\n          profilePictureUrl\n        }\n        ... on GenerativeModelCustomProviderOpenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAzureOpenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAnthropic {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderAWSBedrock {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n          }\n        }\n        ... on GenerativeModelCustomProviderGoogleGenAI {\n          config {\n            __typename\n            ... on UnparsableConfig {\n              parseError\n            }\n          }\n        }\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "aa58663ec66ed9f78983e8cbb3e6d1cf";

export default node;
