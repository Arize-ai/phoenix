/**
 * @generated SignedSource<<c54782603dfbbcef5ac65b5f77513718>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AddDatasetExamplesToDatasetSplitInput = {
  datasetSplitId: string;
  exampleIds: ReadonlyArray<string>;
};
export type ExampleSelectionToolbarAddExamplesToDatasetSplitMutation$variables = {
  input: AddDatasetExamplesToDatasetSplitInput;
};
export type ExampleSelectionToolbarAddExamplesToDatasetSplitMutation$data = {
  readonly addDatasetExamplesToDatasetSplit: {
    readonly datasetSplit: {
      readonly id: string;
      readonly name: string;
    };
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
    "concreteType": "DatasetSplitMutationPayload",
    "kind": "LinkedField",
    "name": "addDatasetExamplesToDatasetSplit",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetSplit",
        "kind": "LinkedField",
        "name": "datasetSplit",
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
    "cacheID": "d5606782963dcf339af58fea5b8a7cbc",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarAddExamplesToDatasetSplitMutation",
    "operationKind": "mutation",
    "text": "mutation ExampleSelectionToolbarAddExamplesToDatasetSplitMutation(\n  $input: AddDatasetExamplesToDatasetSplitInput!\n) {\n  addDatasetExamplesToDatasetSplit(input: $input) {\n    datasetSplit {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "782dea40e38f348b6d6877d83327fbe1";

export default node;
