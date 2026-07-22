/**
 * @generated SignedSource<<93764dfc8e30c221237d6d48b30d031a>>
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
export type ExampleSelectionToolbarDeleteExamplesMutation$variables = {
  input: DeleteDatasetExamplesInput;
};
export type ExampleSelectionToolbarDeleteExamplesMutation$data = {
  readonly deleteDatasetExamples: {
    readonly dataset: {
      readonly id: string;
    };
  };
};
export type ExampleSelectionToolbarDeleteExamplesMutation = {
  response: ExampleSelectionToolbarDeleteExamplesMutation$data;
  variables: ExampleSelectionToolbarDeleteExamplesMutation$variables;
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
    "name": "ExampleSelectionToolbarDeleteExamplesMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ExampleSelectionToolbarDeleteExamplesMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "b63159f3c325b9af3dc469692f9329e5",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarDeleteExamplesMutation",
    "operationKind": "mutation",
    "text": "mutation ExampleSelectionToolbarDeleteExamplesMutation(\n  $input: DeleteDatasetExamplesInput!\n) {\n  deleteDatasetExamples(input: $input) {\n    dataset {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "455bf9e5dc4b9cc655095dc829ef7e12";

export default node;
