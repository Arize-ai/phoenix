/**
 * @generated SignedSource<<2598b874badca3140040185d85190e45>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type EditDatasetDialogMutation$variables = {
  datasetId: string;
  description?: string | null;
  name: string;
};
export type EditDatasetDialogMutation$data = {
  readonly patchDataset: {
    readonly dataset: {
      readonly description: string | null;
      readonly name: string;
    };
  };
};
export type EditDatasetDialogMutation = {
  response: EditDatasetDialogMutation$data;
  variables: EditDatasetDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "datasetId",
            "variableName": "datasetId"
          },
          {
            "kind": "Variable",
            "name": "description",
            "variableName": "description"
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
    "concreteType": "DatasetMutationPayload",
    "kind": "LinkedField",
    "name": "patchDataset",
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
          }
        ],
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
    "name": "EditDatasetDialogMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v2/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "EditDatasetDialogMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "506932e00aeac9d88208a95849fdf74a",
    "id": null,
    "metadata": {},
    "name": "EditDatasetDialogMutation",
    "operationKind": "mutation",
    "text": "mutation EditDatasetDialogMutation(\n  $datasetId: GlobalID!\n  $name: String!\n  $description: String = null\n) {\n  patchDataset(input: {datasetId: $datasetId, name: $name, description: $description}) {\n    dataset {\n      name\n      description\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0069a1443b2eee4ff35b332aef321684";

export default node;
