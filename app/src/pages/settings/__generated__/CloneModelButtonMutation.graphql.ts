/**
 * @generated SignedSource<<e16917a28aed547e778fc322929f41fa>>
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
  startTime?: string | null;
};
export type TokenPriceInput = {
  costPerMillionTokens: number;
  kind: TokenKind;
  tokenType: string;
};
export type CloneModelButtonMutation$variables = {
  connectionId: string;
  input: CreateModelMutationInput;
};
export type CloneModelButtonMutation$data = {
  readonly createModel: {
    readonly __typename: "CreateModelMutationPayload";
    readonly model: {
      readonly " $fragmentSpreads": FragmentRefs<"ModelsTable_generativeModel">;
    };
  };
};
export type CloneModelButtonMutation = {
  response: CloneModelButtonMutation$data;
  variables: CloneModelButtonMutation$variables;
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
    "name": "startTime",
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
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "CloneModelButtonMutation",
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
          },
          (v4/*: any*/)
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
    "name": "CloneModelButtonMutation",
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
          },
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "61e376fc08dc96842849bfdb66c929a4",
    "id": null,
    "metadata": {},
    "name": "CloneModelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation CloneModelButtonMutation(\n  $input: CreateModelMutationInput!\n) {\n  createModel(input: $input) {\n    model {\n      ...ModelsTable_generativeModel\n      id\n    }\n    __typename\n  }\n}\n\nfragment ModelsTable_generativeModel on GenerativeModel {\n  id\n  name\n  provider\n  namePattern\n  providerKey\n  startTime\n  createdAt\n  updatedAt\n  lastUsedAt\n  isOverride\n  tokenPrices {\n    tokenType\n    kind\n    costPerMillionTokens\n    costPerToken\n  }\n}\n"
  }
};
})();

(node as any).hash = "8c7f5945d2ceb11b4a213b458c9ced9d";

export default node;
