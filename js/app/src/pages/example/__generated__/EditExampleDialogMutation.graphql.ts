/**
 * @generated SignedSource<<8ab206d88792c8cc744066d7abef4b7f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PatchDatasetExamplesInput = {
  datasetId?: string | null;
  patches: ReadonlyArray<DatasetExamplePatch>;
  versionDescription?: string | null;
  versionMetadata?: any | null;
};
export type DatasetExamplePatch = {
  exampleId: string;
  input?: any | null;
  metadata?: any | null;
  output?: any | null;
};
export type EditExampleDialogMutation$variables = {
  input: PatchDatasetExamplesInput;
};
export type EditExampleDialogMutation$data = {
  readonly patchDatasetExamples: {
    readonly __typename: "DatasetMutationPayload";
  };
};
export type EditExampleDialogMutation = {
  response: EditExampleDialogMutation$data;
  variables: EditExampleDialogMutation$variables;
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
    "name": "EditExampleDialogMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditExampleDialogMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "7217082d3d3796ecb60481d17133c351",
    "id": null,
    "metadata": {},
    "name": "EditExampleDialogMutation",
    "operationKind": "mutation",
    "text": "mutation EditExampleDialogMutation(\n  $input: PatchDatasetExamplesInput!\n) {\n  patchDatasetExamples(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "a5e0e601ed24ffaa37a99ba358f960d3";

export default node;
