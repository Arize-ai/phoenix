/**
 * @generated SignedSource<<7bc9dd3cf023264ef40499a5183e8861>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateDatasetLabelInput = {
  color: string;
  datasetIds?: ReadonlyArray<string> | null;
  description?: string | null;
  name: string;
};
export type NewDatasetLabelDialogMutation$variables = {
  connections: ReadonlyArray<string>;
  input: CreateDatasetLabelInput;
};
export type NewDatasetLabelDialogMutation$data = {
  readonly createDatasetLabel: {
    readonly datasetLabel: {
      readonly color: string;
      readonly id: string;
      readonly name: string;
    };
    readonly datasets: ReadonlyArray<{
      readonly id: string;
      readonly labels: ReadonlyArray<{
        readonly color: string;
        readonly id: string;
        readonly name: string;
      }>;
    }>;
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
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
  (v3/*: any*/),
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
v5 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetLabel",
  "kind": "LinkedField",
  "name": "datasetLabel",
  "plural": false,
  "selections": (v4/*: any*/),
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "Dataset",
  "kind": "LinkedField",
  "name": "datasets",
  "plural": true,
  "selections": [
    (v3/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": (v4/*: any*/),
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
          (v5/*: any*/),
          (v6/*: any*/)
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
          (v5/*: any*/),
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
          },
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "71e0ce667206a2ec7bf0e9184d5e5adb",
    "id": null,
    "metadata": {},
    "name": "NewDatasetLabelDialogMutation",
    "operationKind": "mutation",
    "text": "mutation NewDatasetLabelDialogMutation(\n  $input: CreateDatasetLabelInput!\n) {\n  createDatasetLabel(input: $input) {\n    datasetLabel {\n      id\n      name\n      color\n    }\n    datasets {\n      id\n      labels {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "aaf5691d872d021a6b76463b3999355c";

export default node;
