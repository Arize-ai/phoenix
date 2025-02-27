/**
 * @generated SignedSource<<b6d216dd10399c4c89ae69a816f7e1e2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type EditDatasetFormMutation$variables = {
  datasetId: string;
  description?: string | null;
  metadata?: any | null;
  name: string;
};
export type EditDatasetFormMutation$data = {
  readonly patchDataset: {
    readonly dataset: {
      readonly description: string | null;
      readonly metadata: any;
      readonly name: string;
    };
  };
};
export type EditDatasetFormMutation = {
  response: EditDatasetFormMutation$data;
  variables: EditDatasetFormMutation$variables;
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
  "name": "metadata"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v4 = [
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "metadata",
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
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditDatasetFormMutation",
    "selections": (v4/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v3/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Operation",
    "name": "EditDatasetFormMutation",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "d68da97aac0aaababba2324b7d10e250",
    "id": null,
    "metadata": {},
    "name": "EditDatasetFormMutation",
    "operationKind": "mutation",
    "text": "mutation EditDatasetFormMutation(\n  $datasetId: GlobalID!\n  $name: String!\n  $description: String = null\n  $metadata: JSON = null\n) {\n  patchDataset(input: {datasetId: $datasetId, name: $name, description: $description, metadata: $metadata}) {\n    dataset {\n      name\n      description\n      metadata\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "17e232f5c22d36d0663f140c00343680";

export default node;
