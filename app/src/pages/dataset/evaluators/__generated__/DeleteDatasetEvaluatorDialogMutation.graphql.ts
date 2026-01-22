/**
 * @generated SignedSource<<889176931d8e74866c406bd9bb381ed7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteDatasetEvaluatorsInput = {
  datasetEvaluatorIds: ReadonlyArray<string>;
  deleteAssociatedPrompt?: boolean;
};
export type DeleteDatasetEvaluatorDialogMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  input: DeleteDatasetEvaluatorsInput;
};
export type DeleteDatasetEvaluatorDialogMutation$data = {
  readonly deleteDatasetEvaluators: {
    readonly datasetEvaluatorIds: ReadonlyArray<string>;
  };
};
export type DeleteDatasetEvaluatorDialogMutation = {
  response: DeleteDatasetEvaluatorDialogMutation$data;
  variables: DeleteDatasetEvaluatorDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionIds"
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
  "name": "datasetEvaluatorIds",
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
    "name": "DeleteDatasetEvaluatorDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DeleteDatasetEvaluatorsPayload",
        "kind": "LinkedField",
        "name": "deleteDatasetEvaluators",
        "plural": false,
        "selections": [
          (v3/*: any*/)
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
    "name": "DeleteDatasetEvaluatorDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DeleteDatasetEvaluatorsPayload",
        "kind": "LinkedField",
        "name": "deleteDatasetEvaluators",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "deleteEdge",
            "key": "",
            "kind": "ScalarHandle",
            "name": "datasetEvaluatorIds",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connectionIds"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "40463c8c4e8cc53acfe00c18546b1ef5",
    "id": null,
    "metadata": {},
    "name": "DeleteDatasetEvaluatorDialogMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteDatasetEvaluatorDialogMutation(\n  $input: DeleteDatasetEvaluatorsInput!\n) {\n  deleteDatasetEvaluators(input: $input) {\n    datasetEvaluatorIds\n  }\n}\n"
  }
};
})();

(node as any).hash = "0582ebbd666459d823c25e83b5ee7ffc";

export default node;
