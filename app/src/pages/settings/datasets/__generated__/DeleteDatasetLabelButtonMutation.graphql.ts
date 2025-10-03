/**
 * @generated SignedSource<<85442ebe33ba401aa450498d51463d3a>>
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DeleteDatasetLabelButtonMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DeleteDatasetLabelButtonMutation",
    "selections": (v1/*: any*/)
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

(node as any).hash = "865e34a2a79804aaaef98cc9590b1021";

export default node;
