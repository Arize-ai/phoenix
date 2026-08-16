/**
 * @generated SignedSource<<5adb6a43827deb312ebc194ab6fd8efa>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateDatasetSplitInput = {
  color: string;
  description?: string | null;
  metadata?: any | null;
  name: string;
};
export type createDatasetSplitToolMutation$variables = {
  input: CreateDatasetSplitInput;
};
export type createDatasetSplitToolMutation$data = {
  readonly createDatasetSplit: {
    readonly datasetSplit: {
      readonly id: string;
      readonly name: string;
    };
  };
};
export type createDatasetSplitToolMutation = {
  response: createDatasetSplitToolMutation$data;
  variables: createDatasetSplitToolMutation$variables;
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "createDatasetSplitToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "createDatasetSplitToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "32a1ec269a91eeab99c02d9b563cc23d",
    "id": null,
    "metadata": {},
    "name": "createDatasetSplitToolMutation",
    "operationKind": "mutation",
    "text": "mutation createDatasetSplitToolMutation(\n  $input: CreateDatasetSplitInput!\n) {\n  createDatasetSplit(input: $input) {\n    datasetSplit {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ac86096b2402b5e7781c464cb0e79aa2";

export default node;
