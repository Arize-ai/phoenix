/**
 * @generated SignedSource<<7755c3ed07d0c960df6b3ebc617498fc>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteDatasetExamplesInput = {
  datasetId?: string | null;
  datasetVersionDescription?: string | null;
  datasetVersionMetadata?: any | null;
  exampleIds: ReadonlyArray<string>;
};
export type deleteDatasetExamplesToolMutation$variables = {
  input: DeleteDatasetExamplesInput;
};
export type deleteDatasetExamplesToolMutation$data = {
  readonly deleteDatasetExamples: {
    readonly dataset: {
      readonly exampleCount: number;
      readonly id: string;
      readonly name: string;
      readonly updatedAt: string;
    };
  };
};
export type deleteDatasetExamplesToolMutation = {
  response: deleteDatasetExamplesToolMutation$data;
  variables: deleteDatasetExamplesToolMutation$variables;
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
    "name": "deleteDatasetExamples",
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
    "name": "deleteDatasetExamplesToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "deleteDatasetExamplesToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "879065f85983db252529747c88264d3f",
    "id": null,
    "metadata": {},
    "name": "deleteDatasetExamplesToolMutation",
    "operationKind": "mutation",
    "text": "mutation deleteDatasetExamplesToolMutation(\n  $input: DeleteDatasetExamplesInput!\n) {\n  deleteDatasetExamples(input: $input) {\n    dataset {\n      id\n      name\n      exampleCount\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ee4c3fcc72d90617374499aff7687971";

export default node;
