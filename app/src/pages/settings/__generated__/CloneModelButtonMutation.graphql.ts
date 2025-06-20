/**
 * @generated SignedSource<<71c9b26c0b3a1ceea9488b91ab1c0636>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreateModelMutationInput = {
  costs: ReadonlyArray<CostPerTokenInput>;
  name: string;
  namePattern: string;
  provider?: string | null;
};
export type CostPerTokenInput = {
  costPerToken: number;
  isPrompt?: boolean | null;
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
    "concreteType": "SpanCostDetailSummaryEntry",
    "kind": "LinkedField",
    "name": "costDetailSummaryEntries",
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
        "name": "isPrompt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "CostBreakdown",
        "kind": "LinkedField",
        "name": "value",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "tokens",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "cost",
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
    "cacheID": "93f96cf5ee7e0f0b913ea0a8aaee92e9",
    "id": null,
    "metadata": {},
    "name": "CloneModelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation CloneModelButtonMutation(\n  $input: CreateModelMutationInput!\n) {\n  createModel(input: $input) {\n    model {\n      ...ModelsTable_generativeModel\n      id\n    }\n    __typename\n  }\n}\n\nfragment ModelsTable_generativeModel on GenerativeModel {\n  id\n  name\n  provider\n  namePattern\n  providerKey\n  createdAt\n  updatedAt\n  lastUsedAt\n  isOverride\n  costDetailSummaryEntries {\n    tokenType\n    isPrompt\n    value {\n      tokens\n      cost\n      costPerToken\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8c7f5945d2ceb11b4a213b458c9ced9d";

export default node;
