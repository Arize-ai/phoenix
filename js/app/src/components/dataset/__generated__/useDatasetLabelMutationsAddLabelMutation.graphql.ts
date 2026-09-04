/**
 * @generated SignedSource<<e31d13093dd702ab4dd89ca9f0d8ec25>>
 * @lightSyntaxTransform
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
export type useDatasetLabelMutationsAddLabelMutation$variables = {
  connections: ReadonlyArray<string>;
  input: CreateDatasetLabelInput;
};
export type useDatasetLabelMutationsAddLabelMutation$data = {
  readonly createDatasetLabel: {
    readonly datasetLabel: {
      readonly color: string;
      readonly id: string;
      readonly name: string;
      readonly usageCount: number;
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
export type useDatasetLabelMutationsAddLabelMutation = {
  response: useDatasetLabelMutationsAddLabelMutation$data;
  variables: useDatasetLabelMutationsAddLabelMutation$variables;
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
  "concreteType": "DatasetLabel",
  "kind": "LinkedField",
  "name": "datasetLabel",
  "plural": false,
  "selections": [
    (v3/*:: as any*/),
    (v4/*:: as any*/),
    (v5/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "usageCount",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "Dataset",
  "kind": "LinkedField",
  "name": "datasets",
  "plural": true,
  "selections": [
    (v3/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": [
        (v3/*:: as any*/),
        (v4/*:: as any*/),
        (v5/*:: as any*/)
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
    "name": "useDatasetLabelMutationsAddLabelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "CreateDatasetLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createDatasetLabel",
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
    "name": "useDatasetLabelMutationsAddLabelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "CreateDatasetLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createDatasetLabel",
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
          (v7/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "812ff73c35044115993d749c5ebef822",
    "id": null,
    "metadata": {},
    "name": "useDatasetLabelMutationsAddLabelMutation",
    "operationKind": "mutation",
    "text": "mutation useDatasetLabelMutationsAddLabelMutation(\n  $input: CreateDatasetLabelInput!\n) {\n  createDatasetLabel(input: $input) {\n    datasetLabel {\n      id\n      name\n      color\n      usageCount\n    }\n    datasets {\n      id\n      labels {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "edd67fe48c47ce070d116d1de17602ae";

export default node;
