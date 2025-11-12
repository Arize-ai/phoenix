/**
 * @generated SignedSource<<707594cdfd4d14039665205b1c9f0013>>
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
    "name": "useDatasetLabelMutationsAddLabelMutation",
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
    "name": "useDatasetLabelMutationsAddLabelMutation",
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
    "cacheID": "2ef998561a150eeacbaffdebc07bc94a",
    "id": null,
    "metadata": {},
    "name": "useDatasetLabelMutationsAddLabelMutation",
    "operationKind": "mutation",
    "text": "mutation useDatasetLabelMutationsAddLabelMutation(\n  $input: CreateDatasetLabelInput!\n) {\n  createDatasetLabel(input: $input) {\n    datasetLabel {\n      id\n      name\n      color\n    }\n    datasets {\n      id\n      labels {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0ea9c100ed6c060e7fc59b9c9f4e9db1";

export default node;
