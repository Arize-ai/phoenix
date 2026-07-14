/**
 * @generated SignedSource<<3b69dfe88c8b220d6804091c3040e311>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AddSpansToDatasetInput = {
  datasetId: string;
  datasetVersionDescription?: string | null;
  datasetVersionMetadata?: any | null;
  spanIds: ReadonlyArray<string>;
};
export type addSpansToDatasetToolMutation$variables = {
  input: AddSpansToDatasetInput;
};
export type addSpansToDatasetToolMutation$data = {
  readonly addSpansToDataset: {
    readonly dataset: {
      readonly id: string;
      readonly name: string;
    };
  };
};
export type addSpansToDatasetToolMutation = {
  response: addSpansToDatasetToolMutation$data;
  variables: addSpansToDatasetToolMutation$variables;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "DatasetMutationPayload",
    "kind": "LinkedField",
    "name": "addSpansToDataset",
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
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "addSpansToDatasetToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "addSpansToDatasetToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "e6726d9163b354e86835a766effb0daf",
    "id": null,
    "metadata": {},
    "name": "addSpansToDatasetToolMutation",
    "operationKind": "mutation",
    "text": "mutation addSpansToDatasetToolMutation(\n  $input: AddSpansToDatasetInput!\n) {\n  addSpansToDataset(input: $input) {\n    dataset {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "958b7273436747987a87928e872f7b0d";

export default node;
