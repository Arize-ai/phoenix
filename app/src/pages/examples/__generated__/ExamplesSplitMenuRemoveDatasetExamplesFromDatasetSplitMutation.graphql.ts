/**
 * @generated SignedSource<<4dcf2db3d7fea5a9191c8aa767d414d4>>
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
export type ExamplesSplitMenuRemoveDatasetExamplesFromDatasetSplitMutation$variables = {
  input: RemoveDatasetExamplesFromDatasetSplitsInput;
};
export type ExamplesSplitMenuRemoveDatasetExamplesFromDatasetSplitMutation$data = {
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
export type ExamplesSplitMenuRemoveDatasetExamplesFromDatasetSplitMutation = {
  response: ExamplesSplitMenuRemoveDatasetExamplesFromDatasetSplitMutation$data;
  variables: ExamplesSplitMenuRemoveDatasetExamplesFromDatasetSplitMutation$variables;
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
    "name": "ExamplesSplitMenuRemoveDatasetExamplesFromDatasetSplitMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExamplesSplitMenuRemoveDatasetExamplesFromDatasetSplitMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "e3b2e6bd616848c2f27e740723215994",
    "id": null,
    "metadata": {},
    "name": "ExamplesSplitMenuRemoveDatasetExamplesFromDatasetSplitMutation",
    "operationKind": "mutation",
    "text": "mutation ExamplesSplitMenuRemoveDatasetExamplesFromDatasetSplitMutation(\n  $input: RemoveDatasetExamplesFromDatasetSplitsInput!\n) {\n  removeDatasetExamplesFromDatasetSplits(input: $input) {\n    examples {\n      id\n      datasetSplits {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "25d8da010b909c6ad9fcecef89e0c0ea";

export default node;
