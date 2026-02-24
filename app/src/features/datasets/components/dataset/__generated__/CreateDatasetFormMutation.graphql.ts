/**
 * @generated SignedSource<<0a2ddfcbb816054402a5bdb642bec1a7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreateDatasetFormMutation$variables = {
  description?: string | null;
  metadata?: any | null;
  name: string;
};
export type CreateDatasetFormMutation$data = {
  readonly createDataset: {
    readonly dataset: {
      readonly id: string;
      readonly name: string;
      readonly " $fragmentSpreads": FragmentRefs<"DatasetSelect_dataset">;
    };
  };
};
export type CreateDatasetFormMutation = {
  response: CreateDatasetFormMutation$data;
  variables: CreateDatasetFormMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "metadata"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v3 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "description",
        "variableName": "description"
      },
      {
        "kind": "Variable",
        "name": "metadata",
        "variableName": "metadata"
      },
      {
        "kind": "Variable",
        "name": "name",
        "variableName": "name"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = [
  (v4/*: any*/),
  (v5/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "exampleCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "DatasetLabel",
    "kind": "LinkedField",
    "name": "labels",
    "plural": true,
    "selections": [
      (v4/*: any*/),
      (v5/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "color",
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
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateDatasetFormMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "DatasetMutationPayload",
        "kind": "LinkedField",
        "name": "createDataset",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Dataset",
            "kind": "LinkedField",
            "name": "dataset",
            "plural": false,
            "selections": [
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "kind": "InlineDataFragmentSpread",
                "name": "DatasetSelect_dataset",
                "selections": (v6/*: any*/),
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
      (v2/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "CreateDatasetFormMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "DatasetMutationPayload",
        "kind": "LinkedField",
        "name": "createDataset",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Dataset",
            "kind": "LinkedField",
            "name": "dataset",
            "plural": false,
            "selections": (v6/*: any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e795a4b8ebb795f93dea507cba2eef83",
    "id": null,
    "metadata": {},
    "name": "CreateDatasetFormMutation",
    "operationKind": "mutation",
    "text": "mutation CreateDatasetFormMutation(\n  $name: String!\n  $description: String = null\n  $metadata: JSON = null\n) {\n  createDataset(input: {name: $name, description: $description, metadata: $metadata}) {\n    dataset {\n      id\n      name\n      ...DatasetSelect_dataset\n    }\n  }\n}\n\nfragment DatasetSelect_dataset on Dataset {\n  id\n  name\n  exampleCount\n  labels {\n    id\n    name\n    color\n  }\n}\n"
  }
};
})();

(node as any).hash = "1948aa8344d9c6feab99a0c18f2a6988";

export default node;
