/**
 * @generated SignedSource<<529b7e7d25e8ab3414e4c855d8c54d87>>
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
      readonly id: string;
      readonly name: string;
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
    "cacheID": "9eaf1fac40959948180cc3d5a9ea3f46",
    "id": null,
    "metadata": {},
    "name": "patchDatasetExamplesToolMutation",
    "operationKind": "mutation",
    "text": "mutation patchDatasetExamplesToolMutation(\n  $input: PatchDatasetExamplesInput!\n) {\n  patchDatasetExamples(input: $input) {\n    dataset {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2d114158d6b674e082d7c03d4369f91f";

export default node;
