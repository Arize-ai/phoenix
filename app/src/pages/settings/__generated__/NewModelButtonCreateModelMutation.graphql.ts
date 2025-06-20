/**
 * @generated SignedSource<<6129b7b23391eda09fdbf5730b892939>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenKind = "COMPLETION" | "PROMPT";
export type CreateModelMutationInput = {
  costs: ReadonlyArray<TokenPriceInput>;
  name: string;
  namePattern: string;
  provider?: string | null;
};
export type TokenPriceInput = {
  costPerMillionTokens: number;
  kind: TokenKind;
  tokenType: string;
};
export type NewModelButtonCreateModelMutation$variables = {
  connectionId: string;
  input: CreateModelMutationInput;
};
export type NewModelButtonCreateModelMutation$data = {
  readonly createModel: {
    readonly model: {
      readonly " $fragmentSpreads": FragmentRefs<"ModelsTable_generativeModel">;
    };
  };
};
export type NewModelButtonCreateModelMutation = {
  response: NewModelButtonCreateModelMutation$data;
  variables: NewModelButtonCreateModelMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "id",
    "storageKey": null
  },
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
    "name": "provider",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "namePattern",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "providerKey",
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
    "kind": "ScalarField",
    "name": "lastUsedAt",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "isOverride",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "TokenPrice",
    "kind": "LinkedField",
    "name": "tokenPrices",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "tokenType",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "kind",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "costPerMillionTokens",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "costPerToken",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "NewModelButtonCreateModelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "CreateModelMutationPayload",
        "kind": "LinkedField",
        "name": "createModel",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "GenerativeModel",
            "kind": "LinkedField",
            "name": "model",
            "plural": false,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "ModelsTable_generativeModel",
                "selections": (v3/*: any*/),
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "NewModelButtonCreateModelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "CreateModelMutationPayload",
        "kind": "LinkedField",
        "name": "createModel",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "GenerativeModel",
            "kind": "LinkedField",
            "name": "model",
            "plural": false,
            "selections": (v3/*: any*/),
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "model",
            "handleArgs": [
              {
                "items": [
                  {
                    "kind": "Variable",
                    "name": "connections.0",
                    "variableName": "connectionId"
                  }
                ],
                "kind": "ListValue",
                "name": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "GenerativeModelEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4cc2e1c51d39fa4c511b0bd7579c9598",
    "id": null,
    "metadata": {},
    "name": "NewModelButtonCreateModelMutation",
    "operationKind": "mutation",
    "text": "mutation NewModelButtonCreateModelMutation(\n  $input: CreateModelMutationInput!\n) {\n  createModel(input: $input) {\n    model {\n      ...ModelsTable_generativeModel\n      id\n    }\n  }\n}\n\nfragment ModelsTable_generativeModel on GenerativeModel {\n  id\n  name\n  provider\n  namePattern\n  providerKey\n  createdAt\n  updatedAt\n  lastUsedAt\n  isOverride\n  tokenPrices {\n    tokenType\n    kind\n    costPerMillionTokens\n    costPerToken\n  }\n}\n"
  }
};
})();

(node as any).hash = "28aa1ca35d2bc831379013a8e7abeebc";

export default node;
