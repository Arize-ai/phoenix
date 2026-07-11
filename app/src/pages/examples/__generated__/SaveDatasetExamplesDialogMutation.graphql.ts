/**
 * @generated SignedSource<<43e7cacfbde10647867d94df96905a02>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ApplyDatasetExampleChangesInput = {
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
  input: ApplyDatasetExampleChangesInput;
};
export type SaveDatasetExamplesDialogMutation$data = {
  readonly applyDatasetExampleChanges: {
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
    "name": "applyDatasetExampleChanges",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SaveDatasetExamplesDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SaveDatasetExamplesDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "1a45eb56db5958005a3965de95c6703a",
    "id": null,
    "metadata": {},
    "name": "SaveDatasetExamplesDialogMutation",
    "operationKind": "mutation",
    "text": "mutation SaveDatasetExamplesDialogMutation(\n  $input: ApplyDatasetExampleChangesInput!\n) {\n  applyDatasetExampleChanges(input: $input) {\n    dataset {\n      id\n      exampleCount\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "81f1d24dc029e45a7d242c6c07da0057";

export default node;
