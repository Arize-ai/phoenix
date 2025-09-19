/**
 * @generated SignedSource<<5549da7bf686b1005fb9e9c5045c7339>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExampleSelectionToolbarSplitsForExamplesQuery$variables = {
  exampleIds: ReadonlyArray<string>;
};
export type ExampleSelectionToolbarSplitsForExamplesQuery$data = {
  readonly datasetSplitsForExamples: ReadonlyArray<{
    readonly datasetSplit: {
      readonly id: string;
      readonly name: string;
    };
    readonly selectedExampleCount: number;
  }>;
};
export type ExampleSelectionToolbarSplitsForExamplesQuery = {
  response: ExampleSelectionToolbarSplitsForExamplesQuery$data;
  variables: ExampleSelectionToolbarSplitsForExamplesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "exampleIds"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "exampleIds",
        "variableName": "exampleIds"
      }
    ],
    "concreteType": "DatasetSplitSelectionInfo",
    "kind": "LinkedField",
    "name": "datasetSplitsForExamples",
    "plural": true,
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
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "selectedExampleCount",
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
    "name": "ExampleSelectionToolbarSplitsForExamplesQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExampleSelectionToolbarSplitsForExamplesQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "3ae5c1207272801392bc163d11f31956",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarSplitsForExamplesQuery",
    "operationKind": "query",
    "text": "query ExampleSelectionToolbarSplitsForExamplesQuery(\n  $exampleIds: [ID!]!\n) {\n  datasetSplitsForExamples(exampleIds: $exampleIds) {\n    datasetSplit {\n      id\n      name\n    }\n    selectedExampleCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "a3c6a1f42e4dc4fc9784949783982c28";

export default node;
