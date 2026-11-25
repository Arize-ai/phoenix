/**
 * @generated SignedSource<<4ccb2495dc824c50228a110f3db30b19>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteProjectEvaluatorsInput = {
  deleteAssociatedPromptOrDecision?: boolean;
  projectEvaluatorIds: ReadonlyArray<string>;
};
export type useDeleteProjectEvaluatorsMutation$variables = {
  input: DeleteProjectEvaluatorsInput;
};
export type useDeleteProjectEvaluatorsMutation$data = {
  readonly deleteProjectEvaluators: {
    readonly projectEvaluatorIds: ReadonlyArray<string>;
  };
};
export type useDeleteProjectEvaluatorsMutation = {
  response: useDeleteProjectEvaluatorsMutation$data;
  variables: useDeleteProjectEvaluatorsMutation$variables;
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
    "name": "useDeleteProjectEvaluatorsMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useDeleteProjectEvaluatorsMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "e61ad20b361cc2b00405efb7fda21f5c",
    "id": null,
    "metadata": {},
    "name": "useDeleteProjectEvaluatorsMutation",
    "operationKind": "mutation",
    "text": "mutation useDeleteProjectEvaluatorsMutation(\n  $input: DeleteProjectEvaluatorsInput!\n) {\n  deleteProjectEvaluators(input: $input) {\n    projectEvaluatorIds\n  }\n}\n"
  }
};
})();

(node as any).hash = "b496ee7131da52874920109f3f28fa5c";

export default node;
