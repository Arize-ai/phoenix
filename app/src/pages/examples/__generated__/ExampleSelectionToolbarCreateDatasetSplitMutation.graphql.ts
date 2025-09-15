/**
 * @generated SignedSource<<96e25d4fd6711578744444f7310098f1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateDatasetSplitInput = {
  description?: string | null;
  name: string;
};
export type ExampleSelectionToolbarCreateDatasetSplitMutation$variables = {
  input: CreateDatasetSplitInput;
};
export type ExampleSelectionToolbarCreateDatasetSplitMutation$data = {
  readonly createDatasetSplit: {
    readonly datasetSplit: {
      readonly id: string;
      readonly name: string;
    };
  };
};
export type ExampleSelectionToolbarCreateDatasetSplitMutation = {
  response: ExampleSelectionToolbarCreateDatasetSplitMutation$data;
  variables: ExampleSelectionToolbarCreateDatasetSplitMutation$variables;
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
    "name": "createDatasetSplit",
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
    "name": "ExampleSelectionToolbarCreateDatasetSplitMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExampleSelectionToolbarCreateDatasetSplitMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "929476d959451783ca5072c5fc31faa6",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarCreateDatasetSplitMutation",
    "operationKind": "mutation",
    "text": "mutation ExampleSelectionToolbarCreateDatasetSplitMutation(\n  $input: CreateDatasetSplitInput!\n) {\n  createDatasetSplit(input: $input) {\n    datasetSplit {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b542c993f60452ea2429fcd3f41ad1a0";

export default node;
