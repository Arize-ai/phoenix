/**
 * @generated SignedSource<<c75ce25a369e15f690873105b7e4798b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateDatasetLabelInput = {
  color: string;
  datasetIds?: ReadonlyArray<string> | null;
  description?: string | null;
  name: string;
};
export type createDatasetLabelToolMutation$variables = {
  input: CreateDatasetLabelInput;
};
export type createDatasetLabelToolMutation$data = {
  readonly createDatasetLabel: {
    readonly datasetLabel: {
      readonly id: string;
      readonly name: string;
    };
  };
};
export type createDatasetLabelToolMutation = {
  response: createDatasetLabelToolMutation$data;
  variables: createDatasetLabelToolMutation$variables;
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
    "concreteType": "CreateDatasetLabelMutationPayload",
    "kind": "LinkedField",
    "name": "createDatasetLabel",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetLabel",
        "kind": "LinkedField",
        "name": "datasetLabel",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
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
    "name": "createDatasetLabelToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "createDatasetLabelToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "c5474baf1b860ad59bd8b47fc792f2b9",
    "id": null,
    "metadata": {},
    "name": "createDatasetLabelToolMutation",
    "operationKind": "mutation",
    "text": "mutation createDatasetLabelToolMutation(\n  $input: CreateDatasetLabelInput!\n) {\n  createDatasetLabel(input: $input) {\n    datasetLabel {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0096f99b1bcbad4ca582579c3f74b1ba";

export default node;
