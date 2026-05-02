/**
 * @generated SignedSource<<cd73776acfd58b841e143050f5e9730f>>
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
export type AddExampleFromScratchFormMutation$variables = {
  input: AddExamplesToDatasetInput;
};
export type AddExampleFromScratchFormMutation$data = {
  readonly addExamplesToDataset: {
    readonly __typename: "DatasetMutationPayload";
  };
};
export type AddExampleFromScratchFormMutation = {
  response: AddExampleFromScratchFormMutation$data;
  variables: AddExampleFromScratchFormMutation$variables;
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
    "name": "AddExampleFromScratchFormMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "AddExampleFromScratchFormMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "240d1881906e55bc48b2940ec829f7fd",
    "id": null,
    "metadata": {},
    "name": "AddExampleFromScratchFormMutation",
    "operationKind": "mutation",
    "text": "mutation AddExampleFromScratchFormMutation(\n  $input: AddExamplesToDatasetInput!\n) {\n  addExamplesToDataset(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "b75bd1ec414ce943900b0f3a8469f333";

export default node;
