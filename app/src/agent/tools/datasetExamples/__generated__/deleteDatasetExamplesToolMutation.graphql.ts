/**
 * @generated SignedSource<<77af947a39ae5c64b39635262c0eb981>>
 * @lightSyntaxTransform
 * @nogrep
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
      readonly id: string;
      readonly name: string;
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
    "name": "deleteDatasetExamplesToolMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "deleteDatasetExamplesToolMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "6caf944a18e7f46a8c2a1dc8a5515bd9",
    "id": null,
    "metadata": {},
    "name": "deleteDatasetExamplesToolMutation",
    "operationKind": "mutation",
    "text": "mutation deleteDatasetExamplesToolMutation(\n  $input: DeleteDatasetExamplesInput!\n) {\n  deleteDatasetExamples(input: $input) {\n    dataset {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c5671fa5981df2174655ab8edae1ecbc";

export default node;
