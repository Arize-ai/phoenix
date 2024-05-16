/**
 * @generated SignedSource<<91de17d830e585b9bea1e8e2581d25eb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type CreateDatasetFormMutation$variables = {
  description?: string | null;
  metadata?: any | null;
  name: string;
};
export type CreateDatasetFormMutation$data = {
  readonly createDataset: {
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
  };
};
export type CreateDatasetFormMutation = {
  response: CreateDatasetFormMutation$data;
  variables: CreateDatasetFormMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "metadata"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "description",
        "variableName": "description"
      },
      {
        "kind": "Variable",
        "name": "metadata",
        "variableName": "metadata"
      },
      {
        "kind": "Variable",
        "name": "name",
        "variableName": "name"
      }
    ],
    "concreteType": "Dataset",
    "kind": "LinkedField",
    "name": "createDataset",
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
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "description",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateDatasetFormMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "CreateDatasetFormMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "a7c591a53c426ce4a7e8b32ba8841dac",
    "id": null,
    "metadata": {},
    "name": "CreateDatasetFormMutation",
    "operationKind": "mutation",
    "text": "mutation CreateDatasetFormMutation(\n  $name: String!\n  $description: String = null\n  $metadata: JSON = null\n) {\n  createDataset(name: $name, description: $description, metadata: $metadata) {\n    id\n    name\n    description\n  }\n}\n"
  }
};
})();

(node as any).hash = "517dd55c623a32a39da2f31871e0ee52";

export default node;
