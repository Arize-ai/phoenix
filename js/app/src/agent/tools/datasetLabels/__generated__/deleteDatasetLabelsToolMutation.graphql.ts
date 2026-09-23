/**
 * @generated SignedSource<<6e2441b8ebdfc13eafa2318b6a9dc6a2>>
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
  connections: ReadonlyArray<string>;
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
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "deleteDatasetLabelsToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
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
              (v3/*:: as any*/),
              (v4/*:: as any*/)
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
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "deleteDatasetLabelsToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
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
              (v3/*:: as any*/),
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
              },
              (v4/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
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

(node as any).hash = "7adeb8cb7df8bb1411a9fc70ce9fc104";

export default node;
