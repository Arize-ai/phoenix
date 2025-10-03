/**
 * @generated SignedSource<<7c229594bc1ab64fc1359da102053b55>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteDatasetLabelsInput = {
  datasetLabelIds: ReadonlyArray<string>;
};
export type DeleteDatasetLabelButtonMutation$variables = {
  connections: ReadonlyArray<string>;
  input: DeleteDatasetLabelsInput;
};
export type DeleteDatasetLabelButtonMutation$data = {
  readonly deleteDatasetLabels: {
    readonly datasetLabels: ReadonlyArray<{
      readonly id: string;
    }>;
  };
};
export type DeleteDatasetLabelButtonMutation = {
  response: DeleteDatasetLabelButtonMutation$data;
  variables: DeleteDatasetLabelButtonMutation$variables;
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
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DeleteDatasetLabelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
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
              (v3/*: any*/)
            ],
            "storageKey": null
          }
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
    "name": "DeleteDatasetLabelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
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
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "filters": null,
                "handle": "deleteEdge",
                "key": "",
                "kind": "ScalarHandle",
                "name": "id",
                "handleArgs": [
                  {
                    "kind": "Variable",
                    "name": "connections",
                    "variableName": "connections"
                  }
                ]
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b8a0548c9df74137476118cf38dfcc9c",
    "id": null,
    "metadata": {},
    "name": "DeleteDatasetLabelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteDatasetLabelButtonMutation(\n  $input: DeleteDatasetLabelsInput!\n) {\n  deleteDatasetLabels(input: $input) {\n    datasetLabels {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e84ccde3a71540e1e768694c2a6adb56";

export default node;
