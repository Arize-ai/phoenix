/**
 * @generated SignedSource<<f9f8b9cb78d6d6ebd83c665408980953>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AddSpansToDatasetInput = {
  datasetId: string;
  datasetVersionDescription?: string | null;
  datasetVersionMetadata?: any | null;
  spanIds: ReadonlyArray<string>;
};
export type SpanSelectionToolbarAddSpansToDatasetMutation$variables = {
  input: AddSpansToDatasetInput;
};
export type SpanSelectionToolbarAddSpansToDatasetMutation$data = {
  readonly addSpansToDataset: {
    readonly dataset: {
      readonly id: string;
    };
  };
};
export type SpanSelectionToolbarAddSpansToDatasetMutation = {
  response: SpanSelectionToolbarAddSpansToDatasetMutation$data;
  variables: SpanSelectionToolbarAddSpansToDatasetMutation$variables;
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
    "name": "addSpansToDataset",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanSelectionToolbarAddSpansToDatasetMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SpanSelectionToolbarAddSpansToDatasetMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "1c694540190478b8fba8ef3c0cacf30c",
    "id": null,
    "metadata": {},
    "name": "SpanSelectionToolbarAddSpansToDatasetMutation",
    "operationKind": "mutation",
    "text": "mutation SpanSelectionToolbarAddSpansToDatasetMutation(\n  $input: AddSpansToDatasetInput!\n) {\n  addSpansToDataset(input: $input) {\n    dataset {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5e3aef907285081a06c0e0360045e865";

export default node;
