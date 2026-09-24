/**
 * @generated SignedSource<<7f9ca463d6421f93ed839fe3890a92d5>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteDatasetLabelsInput = {
  datasetLabelIds: ReadonlyArray<string>;
};
export type deleteDatasetLabelsToolMutation$variables = {
  input: DeleteDatasetLabelsInput;
};
export type deleteDatasetLabelsToolMutation$data = {
  readonly deleteDatasetLabels: {
    readonly datasetLabels: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type deleteDatasetLabelsToolMutation = {
  response: deleteDatasetLabelsToolMutation$data;
  variables: deleteDatasetLabelsToolMutation$variables;
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
    "concreteType": "DeleteDatasetLabelsMutationPayload",
    "kind": "LinkedField",
    "name": "deleteDatasetLabels",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetLabel",
        "kind": "LinkedField",
        "name": "datasetLabels",
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
    "name": "deleteDatasetLabelsToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "deleteDatasetLabelsToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "07079e3bb26c8fdb68b60ddaf0f93916",
    "id": null,
    "metadata": {},
    "name": "deleteDatasetLabelsToolMutation",
    "operationKind": "mutation",
    "text": "mutation deleteDatasetLabelsToolMutation(\n  $input: DeleteDatasetLabelsInput!\n) {\n  deleteDatasetLabels(input: $input) {\n    datasetLabels {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4795e04a55f86206270c6bc584214aff";

export default node;
