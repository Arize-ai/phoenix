/**
 * @generated SignedSource<<6de4dbc0eec53e1d0dab5cdeadd90ed2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteDatasetDialogMutation$variables = {
  datasetId: string;
};
export type DeleteDatasetDialogMutation$data = {
  readonly deleteDataset: {
    readonly __typename: "DatasetMutationPayload";
  };
};
export type DeleteDatasetDialogMutation = {
  response: DeleteDatasetDialogMutation$data;
  variables: DeleteDatasetDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "datasetId",
            "variableName": "datasetId"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "DatasetMutationPayload",
    "kind": "LinkedField",
    "name": "deleteDataset",
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
    "name": "DeleteDatasetDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DeleteDatasetDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "dd7db4b6f6eac9ceaecd096c341e427c",
    "id": null,
    "metadata": {},
    "name": "DeleteDatasetDialogMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteDatasetDialogMutation(\n  $datasetId: ID!\n) {\n  deleteDataset(input: {datasetId: $datasetId}) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "bd97316dd472eec18504f66e16088abc";

export default node;
