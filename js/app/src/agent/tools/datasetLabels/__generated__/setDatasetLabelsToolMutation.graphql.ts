/**
 * @generated SignedSource<<e86ff652bdce90c67eeaa0c993c0688f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetDatasetLabelsInput = {
  datasetId: string;
  datasetLabelIds: ReadonlyArray<string>;
};
export type setDatasetLabelsToolMutation$variables = {
  input: SetDatasetLabelsInput;
};
export type setDatasetLabelsToolMutation$data = {
  readonly setDatasetLabels: {
    readonly dataset: {
      readonly id: string;
      readonly labels: ReadonlyArray<{
        readonly color: string;
        readonly id: string;
        readonly name: string;
      }>;
    };
  };
};
export type setDatasetLabelsToolMutation = {
  response: setDatasetLabelsToolMutation$data;
  variables: setDatasetLabelsToolMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "SetDatasetLabelsMutationPayload",
    "kind": "LinkedField",
    "name": "setDatasetLabels",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Dataset",
        "kind": "LinkedField",
        "name": "dataset",
        "plural": false,
        "selections": [
          (v1/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetLabel",
            "kind": "LinkedField",
            "name": "labels",
            "plural": true,
            "selections": [
              (v1/*:: as any*/),
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
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "setDatasetLabelsToolMutation",
    "selections": (v2/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "setDatasetLabelsToolMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "c717699172af7e22a41f506895d52af8",
    "id": null,
    "metadata": {},
    "name": "setDatasetLabelsToolMutation",
    "operationKind": "mutation",
    "text": "mutation setDatasetLabelsToolMutation(\n  $input: SetDatasetLabelsInput!\n) {\n  setDatasetLabels(input: $input) {\n    dataset {\n      id\n      labels {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e3431b47d5510b42deae4050b9d57fc1";

export default node;
