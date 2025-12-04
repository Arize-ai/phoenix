/**
 * @generated SignedSource<<8cc1f95c9b2589e7628b1c99bf5a7cd7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetDatasetExampleSplitsInput = {
  datasetSplitIds: ReadonlyArray<string>;
  exampleId: string;
};
export type ExamplesSplitMenuSetDatasetExampleSplitsMutation$variables = {
  input: SetDatasetExampleSplitsInput;
};
export type ExamplesSplitMenuSetDatasetExampleSplitsMutation$data = {
  readonly setDatasetExampleSplits: {
    readonly example: {
      readonly datasetSplits: ReadonlyArray<{
        readonly color: string;
        readonly id: string;
        readonly name: string;
      }>;
      readonly id: string;
    };
  };
};
export type ExamplesSplitMenuSetDatasetExampleSplitsMutation = {
  response: ExamplesSplitMenuSetDatasetExampleSplitsMutation$data;
  variables: ExamplesSplitMenuSetDatasetExampleSplitsMutation$variables;
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
    "concreteType": "SetDatasetExampleSplitsMutationPayload",
    "kind": "LinkedField",
    "name": "setDatasetExampleSplits",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetExample",
        "kind": "LinkedField",
        "name": "example",
        "plural": false,
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
    "name": "ExamplesSplitMenuSetDatasetExampleSplitsMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExamplesSplitMenuSetDatasetExampleSplitsMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "1e889bb8ef7a5895e99805253ee885bd",
    "id": null,
    "metadata": {},
    "name": "ExamplesSplitMenuSetDatasetExampleSplitsMutation",
    "operationKind": "mutation",
    "text": "mutation ExamplesSplitMenuSetDatasetExampleSplitsMutation(\n  $input: SetDatasetExampleSplitsInput!\n) {\n  setDatasetExampleSplits(input: $input) {\n    example {\n      id\n      datasetSplits {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "dcb82815c764b4e4f0636a7cfd8c7761";

export default node;
