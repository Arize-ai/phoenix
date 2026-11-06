/**
 * @generated SignedSource<<535df0bf3659c6914ddc0939cd87c2a8>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AddExamplesToDatasetInput = {
  datasetId: string;
  datasetVersionDescription?: string | null;
  datasetVersionMetadata?: any | null;
  examples: ReadonlyArray<DatasetExampleInput>;
};
export type DatasetExampleInput = {
  externalId?: string | null;
  input: any;
  metadata: any;
  output: any;
  spanId?: string | null;
};
export type addDatasetExamplesToolMutation$variables = {
  input: AddExamplesToDatasetInput;
};
export type addDatasetExamplesToolMutation$data = {
  readonly addExamplesToDataset: {
    readonly dataset: {
      readonly exampleCount: number;
      readonly id: string;
      readonly name: string;
      readonly updatedAt: string;
    };
  };
};
export type addDatasetExamplesToolMutation = {
  response: addDatasetExamplesToolMutation$data;
  variables: addDatasetExamplesToolMutation$variables;
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
    "name": "addExamplesToDataset",
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
    "name": "addDatasetExamplesToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "addDatasetExamplesToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "daaccc3e4b2cd129d58398b0a84bb815",
    "id": null,
    "metadata": {},
    "name": "addDatasetExamplesToolMutation",
    "operationKind": "mutation",
    "text": "mutation addDatasetExamplesToolMutation(\n  $input: AddExamplesToDatasetInput!\n) {\n  addExamplesToDataset(input: $input) {\n    dataset {\n      id\n      name\n      exampleCount\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "fd08aaa1461feee4b9625d6cbdf1bf11";

export default node;
