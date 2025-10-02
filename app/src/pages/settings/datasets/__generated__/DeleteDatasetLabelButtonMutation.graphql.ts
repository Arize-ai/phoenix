/**
 * @generated SignedSource<<d27a12eacf525578977f1699ad7a2696>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteDatasetLabelsInput = {
  datasetLabelIds: ReadonlyArray<string>;
};
export type DeleteDatasetLabelButtonMutation$variables = {
  connections: ReadonlyArray<string>;
  input: DeleteDatasetLabelsInput;
};
export type DeleteDatasetLabelButtonMutation$data = {
  readonly deleteDatasetLabels: {
    readonly datasetLabels: ReadonlyArray<{
      readonly id: string;
    }>;
  };
};
export type DeleteDatasetLabelButtonMutation = {
  response: DeleteDatasetLabelButtonMutation$data;
  variables: DeleteDatasetLabelButtonMutation$variables;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DeleteDatasetLabelButtonMutation",
    "selections": (v2/*: any*/),
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
    "name": "DeleteDatasetLabelButtonMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "b8a0548c9df74137476118cf38dfcc9c",
    "id": null,
    "metadata": {},
    "name": "DeleteDatasetLabelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteDatasetLabelButtonMutation(\n  $input: DeleteDatasetLabelsInput!\n) {\n  deleteDatasetLabels(input: $input) {\n    datasetLabels {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "519ffcac85d00b2af31ebfc4df91abfd";

export default node;
