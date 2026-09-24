/**
 * @generated SignedSource<<ca1e8ea0bfd1c363ac99f3350f620bbf>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteDatasetSplitInput = {
  datasetSplitIds: ReadonlyArray<string>;
};
export type deleteDatasetSplitsToolMutation$variables = {
  input: DeleteDatasetSplitInput;
};
export type deleteDatasetSplitsToolMutation$data = {
  readonly deleteDatasetSplits: {
    readonly datasetSplits: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type deleteDatasetSplitsToolMutation = {
  response: deleteDatasetSplitsToolMutation$data;
  variables: deleteDatasetSplitsToolMutation$variables;
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
    "concreteType": "DeleteDatasetSplitsMutationPayload",
    "kind": "LinkedField",
    "name": "deleteDatasetSplits",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetSplit",
        "kind": "LinkedField",
        "name": "datasetSplits",
        "plural": true,
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
    "name": "deleteDatasetSplitsToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "deleteDatasetSplitsToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "f98fcc6edeb866847b0116928f9c2cfe",
    "id": null,
    "metadata": {},
    "name": "deleteDatasetSplitsToolMutation",
    "operationKind": "mutation",
    "text": "mutation deleteDatasetSplitsToolMutation(\n  $input: DeleteDatasetSplitInput!\n) {\n  deleteDatasetSplits(input: $input) {\n    datasetSplits {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4ed433c1130cfa384bf9a98ec0025e7a";

export default node;
