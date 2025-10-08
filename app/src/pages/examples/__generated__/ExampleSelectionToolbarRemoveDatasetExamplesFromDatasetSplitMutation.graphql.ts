/**
 * @generated SignedSource<<fc5fe968020002631f297d81423d62c2>>
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
    readonly examples: ReadonlyArray<{
      readonly datasetSplits: ReadonlyArray<{
        readonly color: string;
        readonly id: string;
        readonly name: string;
      }>;
      readonly id: string;
    }>;
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
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
        "concreteType": "DatasetExample",
        "kind": "LinkedField",
        "name": "examples",
        "plural": true,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetSplit",
            "kind": "LinkedField",
            "name": "datasetSplits",
            "plural": true,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "color",
                "storageKey": null
              }
            ],
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
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "d0e1a90c1fd3a68738c02aac6f1cdb51",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation",
    "operationKind": "mutation",
    "text": "mutation ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation(\n  $input: RemoveDatasetExamplesFromDatasetSplitsInput!\n) {\n  removeDatasetExamplesFromDatasetSplits(input: $input) {\n    examples {\n      id\n      datasetSplits {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3adeb4422875b23cadabba5b3fa2c5eb";

export default node;
