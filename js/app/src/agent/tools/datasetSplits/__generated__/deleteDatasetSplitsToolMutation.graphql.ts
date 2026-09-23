/**
 * @generated SignedSource<<09f4960d55be8d993cee20a04a755841>>
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
    readonly query: {
      readonly datasetSplits: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly color: string;
            readonly id: string;
            readonly name: string;
          };
        }>;
      };
    };
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
},
v5 = {
  "alias": null,
  "args": null,
  "concreteType": "Query",
  "kind": "LinkedField",
  "name": "query",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetSplitConnection",
      "kind": "LinkedField",
      "name": "datasetSplits",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetSplitEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "DatasetSplit",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v3/*:: as any*/),
                (v4/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "color",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
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
          },
          (v5/*:: as any*/)
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
          },
          (v5/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ce365b008f35047c1303102deaa05cc4",
    "id": null,
    "metadata": {},
    "name": "deleteDatasetSplitsToolMutation",
    "operationKind": "mutation",
    "text": "mutation deleteDatasetSplitsToolMutation(\n  $input: DeleteDatasetSplitInput!\n) {\n  deleteDatasetSplits(input: $input) {\n    datasetSplits {\n      id\n      name\n    }\n    query {\n      datasetSplits {\n        edges {\n          node {\n            id\n            name\n            color\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e857526cd7527b4e687eccafc07d1abf";

export default node;
