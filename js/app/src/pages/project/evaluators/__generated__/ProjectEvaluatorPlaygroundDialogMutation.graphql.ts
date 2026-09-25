/**
 * @generated SignedSource<<0f2b5e6226178239e595c79c573cfd01>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateDatasetFromSpansInput = {
  description?: string | null;
  filterCondition?: string;
  limit?: number;
  metadata?: any | null;
  name: string;
  projectId: string;
};
export type ProjectEvaluatorPlaygroundDialogMutation$variables = {
  input: CreateDatasetFromSpansInput;
};
export type ProjectEvaluatorPlaygroundDialogMutation$data = {
  readonly createDatasetFromSpans: {
    readonly dataset: {
      readonly id: string;
    };
  };
};
export type ProjectEvaluatorPlaygroundDialogMutation = {
  response: ProjectEvaluatorPlaygroundDialogMutation$data;
  variables: ProjectEvaluatorPlaygroundDialogMutation$variables;
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
    "concreteType": "DatasetMutationPayload",
    "kind": "LinkedField",
    "name": "createDatasetFromSpans",
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
    "name": "ProjectEvaluatorPlaygroundDialogMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProjectEvaluatorPlaygroundDialogMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "6d7d5455059832c799b2979c482ba702",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorPlaygroundDialogMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectEvaluatorPlaygroundDialogMutation(\n  $input: CreateDatasetFromSpansInput!\n) {\n  createDatasetFromSpans(input: $input) {\n    dataset {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d1238911037cc80e963e6fa7b5b492b4";

export default node;
