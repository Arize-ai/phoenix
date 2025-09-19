/**
 * @generated SignedSource<<77f65d2320c9cefa04ec22203dcdd167>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RemoveDatasetExamplesFromDatasetSplitInput = {
  datasetSplitId: string;
  exampleIds: ReadonlyArray<string>;
};
export type ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation$variables = {
  input: RemoveDatasetExamplesFromDatasetSplitInput;
};
export type ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation$data = {
  readonly removeDatasetExamplesFromDatasetSplit: {
    readonly datasetSplit: {
      readonly id: string;
      readonly name: string;
    };
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
    "concreteType": "DatasetSplitMutationPayload",
    "kind": "LinkedField",
    "name": "removeDatasetExamplesFromDatasetSplit",
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
    "cacheID": "68c0f1a17b092d277274f351b116b46c",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation",
    "operationKind": "mutation",
    "text": "mutation ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation(\n  $input: RemoveDatasetExamplesFromDatasetSplitInput!\n) {\n  removeDatasetExamplesFromDatasetSplit(input: $input) {\n    datasetSplit {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ca63e57d441139b0104af74981b8251c";

export default node;
