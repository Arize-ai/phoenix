/**
 * @generated SignedSource<<cf964619b5f7baa635def32432147576>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeleteModelMutationInput = {
  id: string;
};
export type DeleteModelButtonMutation$variables = {
  input: DeleteModelMutationInput;
};
export type DeleteModelButtonMutation$data = {
  readonly deleteModel: {
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"ModelsTable_generativeModels">;
    };
  };
};
export type DeleteModelButtonMutation = {
  response: DeleteModelButtonMutation$data;
  variables: DeleteModelButtonMutation$variables;
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
  "name": "kind",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DeleteModelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteModelMutationPayload",
        "kind": "LinkedField",
        "name": "deleteModel",
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
    "name": "DeleteModelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteModelMutationPayload",
        "kind": "LinkedField",
        "name": "deleteModel",
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
                  (v2/*: any*/),
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
                      (v2/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "costPerMillionTokens",
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
    "cacheID": "43c73ccb5b91c9b4b5b7c221e5ed26ea",
    "id": null,
    "metadata": {},
    "name": "DeleteModelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteModelButtonMutation(\n  $input: DeleteModelMutationInput!\n) {\n  deleteModel(input: $input) {\n    query {\n      ...ModelsTable_generativeModels\n    }\n  }\n}\n\nfragment ModelsTable_generativeModels on Query {\n  generativeModels {\n    id\n    name\n    provider\n    namePattern\n    providerKey\n    startTime\n    createdAt\n    updatedAt\n    lastUsedAt\n    kind\n    tokenPrices {\n      tokenType\n      kind\n      costPerMillionTokens\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e9d96c88779253d2bd9260a3e62801aa";

export default node;
