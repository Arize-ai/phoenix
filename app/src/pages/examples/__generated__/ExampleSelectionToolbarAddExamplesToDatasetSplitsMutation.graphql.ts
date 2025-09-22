/**
 * @generated SignedSource<<4f9b16a9036b848ef15c0b2bcace96dd>>
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
export type ExampleSelectionToolbarAddExamplesToDatasetSplitsMutation$variables = {
  input: AddDatasetExamplesToDatasetSplitsInput;
};
export type ExampleSelectionToolbarAddExamplesToDatasetSplitsMutation$data = {
  readonly addDatasetExamplesToDatasetSplits: {
    readonly datasetSplits: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type ExampleSelectionToolbarAddExamplesToDatasetSplitsMutation = {
  response: ExampleSelectionToolbarAddExamplesToDatasetSplitsMutation$data;
  variables: ExampleSelectionToolbarAddExamplesToDatasetSplitsMutation$variables;
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
        "concreteType": "DatasetSplit",
        "kind": "LinkedField",
        "name": "datasetSplits",
        "plural": true,
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
    "name": "ExampleSelectionToolbarAddExamplesToDatasetSplitsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExampleSelectionToolbarAddExamplesToDatasetSplitsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "7c0d2e267f90132a62f34e78431eaedf",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarAddExamplesToDatasetSplitsMutation",
    "operationKind": "mutation",
    "text": "mutation ExampleSelectionToolbarAddExamplesToDatasetSplitsMutation(\n  $input: AddDatasetExamplesToDatasetSplitsInput!\n) {\n  addDatasetExamplesToDatasetSplits(input: $input) {\n    datasetSplits {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "831100ba8e4925d75d5b08ab7d2c51ef";

export default node;
