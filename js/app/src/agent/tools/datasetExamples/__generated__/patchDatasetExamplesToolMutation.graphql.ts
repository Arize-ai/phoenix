/**
 * @generated SignedSource<<32e4e8ce7add03cc9d16832ed2ca2b65>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetExampleField = "INPUT" | "METADATA" | "OUTPUT";
export type PatchDatasetExamplesInput = {
  datasetId: string;
  operations: ReadonlyArray<DatasetExampleOperation>;
  versionDescription?: string | null;
  versionMetadata?: any | null;
};
export type DatasetExampleOperation = {
  add: AddDatasetExampleOperation;
  remove?: never;
  replace?: never;
} | {
  add?: never;
  remove?: never;
  replace: ReplaceDatasetExampleFieldOperation;
} | {
  add?: never;
  remove: RemoveDatasetExampleOperation;
  replace?: never;
};
export type AddDatasetExampleOperation = {
  value: DatasetExampleValueInput;
};
export type DatasetExampleValueInput = {
  externalId?: string | null;
  input: any;
  metadata: any;
  output: any;
};
export type ReplaceDatasetExampleFieldOperation = {
  exampleId: string;
  field: DatasetExampleField;
  value: any;
};
export type RemoveDatasetExampleOperation = {
  exampleId: string;
};
export type patchDatasetExamplesToolMutation$variables = {
  input: PatchDatasetExamplesInput;
};
export type patchDatasetExamplesToolMutation$data = {
  readonly patchDatasetExamples: {
    readonly dataset: {
      readonly exampleCount: number;
      readonly id: string;
      readonly name: string;
      readonly updatedAt: string;
    };
  };
};
export type patchDatasetExamplesToolMutation = {
  response: patchDatasetExamplesToolMutation$data;
  variables: patchDatasetExamplesToolMutation$variables;
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
    "name": "patchDatasetExamples",
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
    "name": "patchDatasetExamplesToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "patchDatasetExamplesToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "56b0a4412246776fa41a5332777d8501",
    "id": null,
    "metadata": {},
    "name": "patchDatasetExamplesToolMutation",
    "operationKind": "mutation",
    "text": "mutation patchDatasetExamplesToolMutation(\n  $input: PatchDatasetExamplesInput!\n) {\n  patchDatasetExamples(input: $input) {\n    dataset {\n      id\n      name\n      exampleCount\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "db8eb46688bf10a93929f9b6c4a8bb7a";

export default node;
