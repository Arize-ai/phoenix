/**
 * @generated SignedSource<<620b15774ea791690bdb460a512edc2c>>
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
export type NewModelButtonCreateModelMutation$variables = {
  input: CreateModelMutationInput;
};
export type NewModelButtonCreateModelMutation$data = {
  readonly createModel: {
    readonly query: {
      readonly generativeModels: ReadonlyArray<{
        readonly id: string;
      }>;
      readonly " $fragmentSpreads": FragmentRefs<"ModelsTable_generativeModels">;
    };
  };
};
export type NewModelButtonCreateModelMutation = {
  response: NewModelButtonCreateModelMutation$data;
  variables: NewModelButtonCreateModelMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "NewModelButtonCreateModelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "CreateModelMutationPayload",
        "kind": "LinkedField",
        "name": "createModel",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "GenerativeModel",
                "kind": "LinkedField",
                "name": "generativeModels",
                "plural": true,
                "selections": [
                  (v2/*: any*/)
                ],
                "storageKey": null
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "ModelsTable_generativeModels"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewModelButtonCreateModelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "CreateModelMutationPayload",
        "kind": "LinkedField",
        "name": "createModel",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "GenerativeModel",
                "kind": "LinkedField",
                "name": "generativeModels",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
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
                  (v3/*: any*/),
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
                      (v3/*: any*/),
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
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "978c0dccdacaa8f56202c6ce03b69170",
    "id": null,
    "metadata": {},
    "name": "NewModelButtonCreateModelMutation",
    "operationKind": "mutation",
    "text": "mutation NewModelButtonCreateModelMutation(\n  $input: CreateModelMutationInput!\n) {\n  createModel(input: $input) {\n    query {\n      generativeModels {\n        id\n      }\n      ...ModelsTable_generativeModels\n    }\n  }\n}\n\nfragment ModelsTable_generativeModels on Query {\n  generativeModels {\n    id\n    name\n    provider\n    namePattern\n    providerKey\n    startTime\n    createdAt\n    updatedAt\n    lastUsedAt\n    kind\n    tokenPrices {\n      tokenType\n      kind\n      costPerMillionTokens\n      costPerToken\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c1c3e531076c830bf86ff1c7f5ae6128";

export default node;
