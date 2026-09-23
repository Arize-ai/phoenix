/**
 * @generated SignedSource<<47188819db6082e3b691e0908a79ec4c>>
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
  connections: ReadonlyArray<string>;
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
    "name": "deleteDatasetSplitsToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
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
    "name": "deleteDatasetSplitsToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
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
    "cacheID": "f98fcc6edeb866847b0116928f9c2cfe",
    "id": null,
    "metadata": {},
    "name": "deleteDatasetSplitsToolMutation",
    "operationKind": "mutation",
    "text": "mutation deleteDatasetSplitsToolMutation(\n  $input: DeleteDatasetSplitInput!\n) {\n  deleteDatasetSplits(input: $input) {\n    datasetSplits {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2c11806f077bdefbeb1dad0731345b45";

export default node;
