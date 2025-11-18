/**
 * @generated SignedSource<<14deddefad66f91b31cc4fa7602c4069>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteEvaluatorsInput = {
  evaluatorIds: ReadonlyArray<string>;
};
export type EvaluatorSelectionToolbarDeleteEvaluatorsMutation$variables = {
  input: DeleteEvaluatorsInput;
};
export type EvaluatorSelectionToolbarDeleteEvaluatorsMutation$data = {
  readonly deleteEvaluators: {
    readonly evaluatorIds: ReadonlyArray<string>;
  };
};
export type EvaluatorSelectionToolbarDeleteEvaluatorsMutation = {
  response: EvaluatorSelectionToolbarDeleteEvaluatorsMutation$data;
  variables: EvaluatorSelectionToolbarDeleteEvaluatorsMutation$variables;
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
    "concreteType": "DeleteEvaluatorsPayload",
    "kind": "LinkedField",
    "name": "deleteEvaluators",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "evaluatorIds",
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
    "name": "EvaluatorSelectionToolbarDeleteEvaluatorsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EvaluatorSelectionToolbarDeleteEvaluatorsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "d67e230fa2830edd7c40a2f342874c23",
    "id": null,
    "metadata": {},
    "name": "EvaluatorSelectionToolbarDeleteEvaluatorsMutation",
    "operationKind": "mutation",
    "text": "mutation EvaluatorSelectionToolbarDeleteEvaluatorsMutation(\n  $input: DeleteEvaluatorsInput!\n) {\n  deleteEvaluators(input: $input) {\n    evaluatorIds\n  }\n}\n"
  }
};
})();

(node as any).hash = "fefa18d28efa9318626ae845f49ffd8e";

export default node;
