/**
 * @generated SignedSource<<8123957bae615e7dd9275ecd1d38655a>>
 * @lightSyntaxTransform
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
    "concreteType": "DeleteProjectEvaluatorsPayload",
    "kind": "LinkedField",
    "name": "deleteProjectEvaluators",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "projectEvaluatorIds",
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
    "name": "DeleteProjectEvaluatorDialogMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DeleteProjectEvaluatorDialogMutation",
    "selections": (v1/*:: as any*/)
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

(node as any).hash = "4b4583e4fab10216c432ce2bf4882263";

export default node;
