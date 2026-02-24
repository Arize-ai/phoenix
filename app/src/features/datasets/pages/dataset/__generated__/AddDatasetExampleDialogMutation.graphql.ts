/**
 * @generated SignedSource<<c07f898deea3ff4f2d3da3c98b751c9d>>
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
  input: any;
  metadata: any;
  output: any;
  spanId?: string | null;
};
export type AddDatasetExampleDialogMutation$variables = {
  input: AddExamplesToDatasetInput;
};
export type AddDatasetExampleDialogMutation$data = {
  readonly addExamplesToDataset: {
    readonly __typename: "DatasetMutationPayload";
  };
};
export type AddDatasetExampleDialogMutation = {
  response: AddDatasetExampleDialogMutation$data;
  variables: AddDatasetExampleDialogMutation$variables;
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
        "kind": "ScalarField",
        "name": "__typename",
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
    "name": "AddDatasetExampleDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "AddDatasetExampleDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "718cf02ccb39b279132822bf503e51e6",
    "id": null,
    "metadata": {},
    "name": "AddDatasetExampleDialogMutation",
    "operationKind": "mutation",
    "text": "mutation AddDatasetExampleDialogMutation(\n  $input: AddExamplesToDatasetInput!\n) {\n  addExamplesToDataset(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "8d99470f590cd5d28701fa6e3c0330e6";

export default node;
