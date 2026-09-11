/**
 * @generated SignedSource<<dfa38c295c26d5c5d6ba6051f5dbe92a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PatchDatasetExamplesInput = {
  additions?: ReadonlyArray<DatasetExampleAddition>;
  datasetId: string;
  exampleIdsToDelete?: ReadonlyArray<string>;
  patches?: ReadonlyArray<DatasetExamplePatch>;
  versionDescription?: string | null;
  versionMetadata?: any | null;
};
export type DatasetExampleAddition = {
  externalId?: string | null;
  input: any;
  metadata: any;
  output: any;
};
export type DatasetExamplePatch = {
  exampleId: string;
  input?: any | null;
  metadata?: any | null;
  output?: any | null;
};
export type SaveDatasetExamplesDialogMutation$variables = {
  input: PatchDatasetExamplesInput;
};
export type SaveDatasetExamplesDialogMutation$data = {
  readonly patchDatasetExamples: {
    readonly dataset: {
      readonly exampleCount: number;
      readonly id: string;
    };
  };
};
export type SaveDatasetExamplesDialogMutation = {
  response: SaveDatasetExamplesDialogMutation$data;
  variables: SaveDatasetExamplesDialogMutation$variables;
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SaveDatasetExamplesDialogMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SaveDatasetExamplesDialogMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "d288305363838ec485d9665a37feaa6f",
    "id": null,
    "metadata": {},
    "name": "SaveDatasetExamplesDialogMutation",
    "operationKind": "mutation",
    "text": "mutation SaveDatasetExamplesDialogMutation(\n  $input: PatchDatasetExamplesInput!\n) {\n  patchDatasetExamples(input: $input) {\n    dataset {\n      id\n      exampleCount\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "eeb63ee9ad98972dbc226eaea3abc7cb";

export default node;
