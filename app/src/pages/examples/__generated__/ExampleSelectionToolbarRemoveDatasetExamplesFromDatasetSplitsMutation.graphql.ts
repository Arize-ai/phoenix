/**
 * @generated SignedSource<<f7eae48d6e23e1d628cb45ca60356b37>>
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
export type ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitsMutation$variables = {
  input: RemoveDatasetExamplesFromDatasetSplitsInput;
};
export type ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitsMutation$data = {
  readonly removeDatasetExamplesFromDatasetSplits: {
    readonly __typename: "RemoveDatasetExamplesFromDatasetSplitsMutationPayload";
  };
};
export type ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitsMutation = {
  response: ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitsMutation$data;
  variables: ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitsMutation$variables;
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
    "name": "ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a5dadc4dabc8f49eb276d568a96de0b2",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitsMutation",
    "operationKind": "mutation",
    "text": "mutation ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitsMutation(\n  $input: RemoveDatasetExamplesFromDatasetSplitsInput!\n) {\n  removeDatasetExamplesFromDatasetSplits(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "78238e7525e6bd1c52cdbea66b10e259";

export default node;
