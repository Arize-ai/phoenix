/**
 * @generated SignedSource<<c84f1507820db0c5438d248d23bf43ad>>
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
  "concreteType": "DatasetSplit",
  "kind": "LinkedField",
  "name": "datasetSplit",
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
      "name": "description",
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
          (v3/*:: as any*/)
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
          (v3/*:: as any*/),
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
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5d4b496912af3a1afc151db7e370a08a",
    "id": null,
    "metadata": {},
    "name": "createDatasetSplitToolMutation",
    "operationKind": "mutation",
    "text": "mutation createDatasetSplitToolMutation(\n  $input: CreateDatasetSplitInput!\n) {\n  createDatasetSplit(input: $input) {\n    datasetSplit {\n      id\n      name\n      description\n      color\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ea21e65b4a225a3a2ceb2969dd91e27b";

export default node;
