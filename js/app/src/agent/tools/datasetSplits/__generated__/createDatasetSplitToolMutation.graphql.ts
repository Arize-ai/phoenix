/**
 * @generated SignedSource<<75643be65d644d97daaa03c1d13eccc7>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateDatasetSplitInput = {
  color: string;
  description?: string | null;
  metadata?: any | null;
  name: string;
};
export type createDatasetSplitToolMutation$variables = {
  connections: ReadonlyArray<string>;
  input: CreateDatasetSplitInput;
};
export type createDatasetSplitToolMutation$data = {
  readonly createDatasetSplit: {
    readonly datasetSplit: {
      readonly color: string;
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
    };
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
export type createDatasetSplitToolMutation = {
  response: createDatasetSplitToolMutation$data;
  variables: createDatasetSplitToolMutation$variables;
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
  "kind": "ScalarField",
  "name": "color",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetSplit",
  "kind": "LinkedField",
  "name": "datasetSplit",
  "plural": false,
  "selections": [
    (v3/*:: as any*/),
    (v4/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "description",
      "storageKey": null
    },
    (v5/*:: as any*/)
  ],
  "storageKey": null
},
v7 = {
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
                (v5/*:: as any*/)
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
    "name": "createDatasetSplitToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DatasetSplitMutationPayload",
        "kind": "LinkedField",
        "name": "createDatasetSplit",
        "plural": false,
        "selections": [
          (v6/*:: as any*/),
          (v7/*:: as any*/)
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
    "name": "createDatasetSplitToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DatasetSplitMutationPayload",
        "kind": "LinkedField",
        "name": "createDatasetSplit",
        "plural": false,
        "selections": [
          (v6/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "datasetSplit",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "DatasetSplitEdge"
              }
            ]
          },
          (v7/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4e76870bd2c9d7d8a9dde019089906b8",
    "id": null,
    "metadata": {},
    "name": "createDatasetSplitToolMutation",
    "operationKind": "mutation",
    "text": "mutation createDatasetSplitToolMutation(\n  $input: CreateDatasetSplitInput!\n) {\n  createDatasetSplit(input: $input) {\n    datasetSplit {\n      id\n      name\n      description\n      color\n    }\n    query {\n      datasetSplits {\n        edges {\n          node {\n            id\n            name\n            color\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f18f9fc43a3e23c2a1ff92e25088545d";

export default node;
