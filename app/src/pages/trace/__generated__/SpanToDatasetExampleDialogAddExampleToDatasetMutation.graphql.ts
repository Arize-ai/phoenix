/**
 * @generated SignedSource<<3ae2b473b296435cc921c53c4b11a098>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AddExamplesToDatasetInput = {
  datasetId: string;
  datasetVersionDescription?: string | null;
  datasetVersionMetadata?: any | null;
  examples: ReadonlyArray<DatasetExampleInput>;
};
export type DatasetExampleInput = {
  input: any;
  metadata: any;
  output: any;
  spanId?: string | null;
};
export type SpanToDatasetExampleDialogAddExampleToDatasetMutation$variables = {
  input: AddExamplesToDatasetInput;
};
export type SpanToDatasetExampleDialogAddExampleToDatasetMutation$data = {
  readonly addExamplesToDataset: {
    readonly dataset: {
      readonly id: string;
    };
  };
};
export type SpanToDatasetExampleDialogAddExampleToDatasetMutation = {
  response: SpanToDatasetExampleDialogAddExampleToDatasetMutation$data;
  variables: SpanToDatasetExampleDialogAddExampleToDatasetMutation$variables;
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
    "name": "addExamplesToDataset",
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
    "name": "SpanToDatasetExampleDialogAddExampleToDatasetMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SpanToDatasetExampleDialogAddExampleToDatasetMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "d93c9d47668fc266ba09ecb14c2b72ae",
    "id": null,
    "metadata": {},
    "name": "SpanToDatasetExampleDialogAddExampleToDatasetMutation",
    "operationKind": "mutation",
    "text": "mutation SpanToDatasetExampleDialogAddExampleToDatasetMutation(\n  $input: AddExamplesToDatasetInput!\n) {\n  addExamplesToDataset(input: $input) {\n    dataset {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "75120065d239f28304e9dd91fc34bec9";

export default node;
