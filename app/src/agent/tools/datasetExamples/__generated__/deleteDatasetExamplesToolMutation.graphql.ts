/**
 * @generated SignedSource<<2e0d007a33e452ff8964ca724deff64b>>
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
