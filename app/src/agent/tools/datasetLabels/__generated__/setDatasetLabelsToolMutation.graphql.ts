/**
 * @generated SignedSource<<fba0655c5761d1e2994a426cd8e354af>>
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
v1 = [
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
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
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "setDatasetLabelsToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "3255cb805a4af616e4be354b5ea2d5b5",
    "id": null,
    "metadata": {},
    "name": "setDatasetLabelsToolMutation",
    "operationKind": "mutation",
    "text": "mutation setDatasetLabelsToolMutation(\n  $input: SetDatasetLabelsInput!\n) {\n  setDatasetLabels(input: $input) {\n    dataset {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "346512011109c403f2f9e121f8db72bc";

export default node;
