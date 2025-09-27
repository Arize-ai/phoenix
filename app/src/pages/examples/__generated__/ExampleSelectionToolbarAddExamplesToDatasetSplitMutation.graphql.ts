/**
 * @generated SignedSource<<900eef67045160394912c64f803d531e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AddDatasetExamplesToDatasetSplitsInput = {
  datasetSplitIds: ReadonlyArray<string>;
  exampleIds: ReadonlyArray<string>;
};
export type ExampleSelectionToolbarAddExamplesToDatasetSplitMutation$variables = {
  input: AddDatasetExamplesToDatasetSplitsInput;
};
export type ExampleSelectionToolbarAddExamplesToDatasetSplitMutation$data = {
  readonly addDatasetExamplesToDatasetSplits: {
    readonly __typename: "AddDatasetExamplesToDatasetSplitsMutationPayload";
  };
};
export type ExampleSelectionToolbarAddExamplesToDatasetSplitMutation = {
  response: ExampleSelectionToolbarAddExamplesToDatasetSplitMutation$data;
  variables: ExampleSelectionToolbarAddExamplesToDatasetSplitMutation$variables;
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
    "concreteType": "AddDatasetExamplesToDatasetSplitsMutationPayload",
    "kind": "LinkedField",
    "name": "addDatasetExamplesToDatasetSplits",
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
    "name": "ExampleSelectionToolbarAddExamplesToDatasetSplitMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExampleSelectionToolbarAddExamplesToDatasetSplitMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "15045544deaf38026befc60f6c39f3ba",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarAddExamplesToDatasetSplitMutation",
    "operationKind": "mutation",
    "text": "mutation ExampleSelectionToolbarAddExamplesToDatasetSplitMutation(\n  $input: AddDatasetExamplesToDatasetSplitsInput!\n) {\n  addDatasetExamplesToDatasetSplits(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "440499f92af95f101f3ef50400779375";

export default node;
