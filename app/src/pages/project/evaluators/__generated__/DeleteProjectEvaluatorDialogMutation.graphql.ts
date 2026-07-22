/**
 * @generated SignedSource<<b00a97059370954980b2c2cd48bc48cd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteProjectEvaluatorsInput = {
  deleteAssociatedPrompt?: boolean;
  projectEvaluatorIds: ReadonlyArray<string>;
};
export type DeleteProjectEvaluatorDialogMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  input: DeleteProjectEvaluatorsInput;
};
export type DeleteProjectEvaluatorDialogMutation$data = {
  readonly deleteProjectEvaluators: {
    readonly projectEvaluatorIds: ReadonlyArray<string>;
  };
};
export type DeleteProjectEvaluatorDialogMutation = {
  response: DeleteProjectEvaluatorDialogMutation$data;
  variables: DeleteProjectEvaluatorDialogMutation$variables;
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
  "name": "projectEvaluatorIds",
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
    "name": "DeleteProjectEvaluatorDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DeleteProjectEvaluatorsPayload",
        "kind": "LinkedField",
        "name": "deleteProjectEvaluators",
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
    "name": "DeleteProjectEvaluatorDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DeleteProjectEvaluatorsPayload",
        "kind": "LinkedField",
        "name": "deleteProjectEvaluators",
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
            "name": "projectEvaluatorIds",
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
    "cacheID": "8e69293a1397a603535ae76aa8bf3d8c",
    "id": null,
    "metadata": {},
    "name": "DeleteProjectEvaluatorDialogMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteProjectEvaluatorDialogMutation(\n  $input: DeleteProjectEvaluatorsInput!\n) {\n  deleteProjectEvaluators(input: $input) {\n    projectEvaluatorIds\n  }\n}\n"
  }
};
})();

(node as any).hash = "ce15d04fb35bbcb5797d1203c64daf9e";

export default node;
