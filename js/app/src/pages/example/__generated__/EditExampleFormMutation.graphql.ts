/**
 * @generated SignedSource<<74979189a136a4655a164f760959ad11>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetExampleField = "INPUT" | "METADATA" | "OUTPUT";
export type PatchDatasetExamplesInput = {
  datasetId: string;
  operations: ReadonlyArray<DatasetExampleOperation>;
  versionDescription?: string | null;
  versionMetadata?: any | null;
};
export type DatasetExampleOperation = {
  add: AddDatasetExampleOperation;
  remove?: never;
  replace?: never;
} | {
  add?: never;
  remove?: never;
  replace: ReplaceDatasetExampleFieldOperation;
} | {
  add?: never;
  remove: RemoveDatasetExampleOperation;
  replace?: never;
};
export type AddDatasetExampleOperation = {
  value: DatasetExampleValueInput;
};
export type DatasetExampleValueInput = {
  externalId?: string | null;
  input: any;
  metadata: any;
  output: any;
};
export type ReplaceDatasetExampleFieldOperation = {
  exampleId: string;
  field: DatasetExampleField;
  value: any;
};
export type RemoveDatasetExampleOperation = {
  exampleId: string;
};
export type EditExampleFormMutation$variables = {
  input: PatchDatasetExamplesInput;
};
export type EditExampleFormMutation$data = {
  readonly patchDatasetExamples: {
    readonly __typename: "DatasetMutationPayload";
  };
};
export type EditExampleFormMutation = {
  response: EditExampleFormMutation$data;
  variables: EditExampleFormMutation$variables;
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
    "name": "patchDatasetExamples",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
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
    "name": "EditExampleFormMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditExampleFormMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "67a51ec2a18a504d8433ae4c746b9363",
    "id": null,
    "metadata": {},
    "name": "EditExampleFormMutation",
    "operationKind": "mutation",
    "text": "mutation EditExampleFormMutation(\n  $input: PatchDatasetExamplesInput!\n) {\n  patchDatasetExamples(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "340ed3ebc2fe9f01b5b017e7db14d9b6";

export default node;
