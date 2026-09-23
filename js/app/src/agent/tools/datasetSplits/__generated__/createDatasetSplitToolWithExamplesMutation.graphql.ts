/**
 * @generated SignedSource<<ce8171b469bbef2303982d68845085a7>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateDatasetSplitWithExamplesInput = {
  color: string;
  description?: string | null;
  exampleIds: ReadonlyArray<string>;
  metadata?: any | null;
  name: string;
};
export type createDatasetSplitToolWithExamplesMutation$variables = {
  connections: ReadonlyArray<string>;
  input: CreateDatasetSplitWithExamplesInput;
};
export type createDatasetSplitToolWithExamplesMutation$data = {
  readonly createDatasetSplitWithExamples: {
    readonly datasetSplit: {
      readonly color: string;
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
    };
    readonly examples: ReadonlyArray<{
      readonly datasetSplits: ReadonlyArray<{
        readonly color: string;
        readonly id: string;
        readonly name: string;
      }>;
      readonly id: string;
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
export type createDatasetSplitToolWithExamplesMutation = {
  response: createDatasetSplitToolWithExamplesMutation$data;
  variables: createDatasetSplitToolWithExamplesMutation$variables;
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
v7 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/),
  (v5/*:: as any*/)
],
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetExample",
  "kind": "LinkedField",
  "name": "examples",
  "plural": true,
  "selections": [
    (v3/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetSplit",
      "kind": "LinkedField",
      "name": "datasetSplits",
      "plural": true,
      "selections": (v7/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v9 = {
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
              "selections": (v7/*:: as any*/),
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
    "name": "createDatasetSplitToolWithExamplesMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DatasetSplitMutationPayloadWithExamples",
        "kind": "LinkedField",
        "name": "createDatasetSplitWithExamples",
        "plural": false,
        "selections": [
          (v6/*:: as any*/),
          (v8/*:: as any*/),
          (v9/*:: as any*/)
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
    "name": "createDatasetSplitToolWithExamplesMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DatasetSplitMutationPayloadWithExamples",
        "kind": "LinkedField",
        "name": "createDatasetSplitWithExamples",
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
          (v8/*:: as any*/),
          (v9/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2d6c3679f8a65e72f3d50d1ad6f72f95",
    "id": null,
    "metadata": {},
    "name": "createDatasetSplitToolWithExamplesMutation",
    "operationKind": "mutation",
    "text": "mutation createDatasetSplitToolWithExamplesMutation(\n  $input: CreateDatasetSplitWithExamplesInput!\n) {\n  createDatasetSplitWithExamples(input: $input) {\n    datasetSplit {\n      id\n      name\n      description\n      color\n    }\n    examples {\n      id\n      datasetSplits {\n        id\n        name\n        color\n      }\n    }\n    query {\n      datasetSplits {\n        edges {\n          node {\n            id\n            name\n            color\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "223f5420058c3cdc7c9374a28bda1ad9";

export default node;
