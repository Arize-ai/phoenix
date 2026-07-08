/**
 * @generated SignedSource<<a9c2bf2fa4dd8b8d930697d6e663115e>>
 * @lightSyntaxTransform
 * @nogrep
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "addDatasetExamplesToolMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "addDatasetExamplesToolMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "107ae24f86b9918a24ae87bc750e2e91",
    "id": null,
    "metadata": {},
    "name": "addDatasetExamplesToolMutation",
    "operationKind": "mutation",
    "text": "mutation addDatasetExamplesToolMutation(\n  $input: AddExamplesToDatasetInput!\n) {\n  addExamplesToDataset(input: $input) {\n    dataset {\n      id\n      name\n      exampleCount\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d50fe79671b1d80b02885d3835b615f2";

export default node;
