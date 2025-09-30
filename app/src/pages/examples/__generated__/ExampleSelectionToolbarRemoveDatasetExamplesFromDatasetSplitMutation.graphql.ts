/**
 * @generated SignedSource<<89b851cfcc5de8da0d2fecd3525e0ad6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RemoveDatasetExamplesFromDatasetSplitsInput = {
  datasetSplitIds: ReadonlyArray<string>;
  exampleIds: ReadonlyArray<string>;
};
export type ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation$variables = {
  input: RemoveDatasetExamplesFromDatasetSplitsInput;
};
export type ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation$data = {
  readonly removeDatasetExamplesFromDatasetSplits: {
    readonly __typename: "RemoveDatasetExamplesFromDatasetSplitsMutationPayload";
  };
};
export type ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation = {
  response: ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation$data;
  variables: ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation$variables;
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
    "concreteType": "RemoveDatasetExamplesFromDatasetSplitsMutationPayload",
    "kind": "LinkedField",
    "name": "removeDatasetExamplesFromDatasetSplits",
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
    "name": "ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "930aebc5f7aa89f05a44c5649504d3ee",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation",
    "operationKind": "mutation",
    "text": "mutation ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation(\n  $input: RemoveDatasetExamplesFromDatasetSplitsInput!\n) {\n  removeDatasetExamplesFromDatasetSplits(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "1d1b29fe57ee50492d414a6675e27516";

export default node;
