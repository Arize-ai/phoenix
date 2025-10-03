/**
 * @generated SignedSource<<a0ee5848b68d88ba19ef147f49a11a07>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateDatasetLabelInput = {
  color: string;
  description?: string | null;
  name: string;
};
export type NewDatasetLabelDialogMutation$variables = {
  connections: ReadonlyArray<string>;
  label: CreateDatasetLabelInput;
};
export type NewDatasetLabelDialogMutation$data = {
  readonly createDatasetLabel: {
    readonly datasetLabel: {
      readonly color: string;
      readonly id: string;
      readonly name: string;
    };
  };
};
export type NewDatasetLabelDialogMutation = {
  response: NewDatasetLabelDialogMutation$data;
  variables: NewDatasetLabelDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "label"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "label"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetLabel",
  "kind": "LinkedField",
  "name": "datasetLabel",
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
      "name": "color",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "NewDatasetLabelDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "CreateDatasetLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createDatasetLabel",
        "plural": false,
        "selections": [
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "NewDatasetLabelDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "CreateDatasetLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createDatasetLabel",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "datasetLabel",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "DatasetLabelEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b3ed9cd14a2af6a7956957541826d23c",
    "id": null,
    "metadata": {},
    "name": "NewDatasetLabelDialogMutation",
    "operationKind": "mutation",
    "text": "mutation NewDatasetLabelDialogMutation(\n  $label: CreateDatasetLabelInput!\n) {\n  createDatasetLabel(input: $label) {\n    datasetLabel {\n      id\n      name\n      color\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d7e0eff0307dd56a8cf8aa1a22bdd6d5";

export default node;
