/**
 * @generated SignedSource<<0d1475b317eec06d8572a72af4fdd096>>
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
    readonly query: {
      readonly datasetEvaluatorCount: number;
      readonly projectEvaluatorCount: number;
    };
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
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "query",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "projectEvaluatorCount",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "datasetEvaluatorCount",
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
    "cacheID": "144c2c9685180564166ffafbe6fef4e4",
    "id": null,
    "metadata": {},
    "name": "useDeleteProjectEvaluatorsMutation",
    "operationKind": "mutation",
    "text": "mutation useDeleteProjectEvaluatorsMutation(\n  $input: DeleteProjectEvaluatorsInput!\n) {\n  deleteProjectEvaluators(input: $input) {\n    projectEvaluatorIds\n    query {\n      projectEvaluatorCount\n      datasetEvaluatorCount\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0ee05d8ed7f2cc39d985ba8c56901827";

export default node;
