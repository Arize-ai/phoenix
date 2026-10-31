/**
 * @generated SignedSource<<407b93bdaffd9dac111816f640786bf0>>
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
      readonly exampleCount: number;
      readonly id: string;
      readonly name: string;
      readonly updatedAt: string;
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
          },
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
            "kind": "ScalarField",
            "name": "updatedAt",
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
    "cacheID": "3e4d83269ed185ace20cc1506b527948",
    "id": null,
    "metadata": {},
    "name": "addSpansToDatasetToolMutation",
    "operationKind": "mutation",
    "text": "mutation addSpansToDatasetToolMutation(\n  $input: AddSpansToDatasetInput!\n) {\n  addSpansToDataset(input: $input) {\n    dataset {\n      id\n      name\n      exampleCount\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9c924a16e466f5e871dfb04cbd6794e2";

export default node;
