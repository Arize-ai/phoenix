/**
 * @generated SignedSource<<85f8cd17d4d969e99a0ce88dbad4d27f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type PatchDatasetExamplesInput = {
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
export type EditDatasetExampleDialogMutation$variables = {
  input: PatchDatasetExamplesInput;
};
export type EditDatasetExampleDialogMutation$data = {
  readonly patchDatasetExamples: {
    readonly __typename: "DatasetMutationPayload";
  };
};
export type EditDatasetExampleDialogMutation = {
  response: EditDatasetExampleDialogMutation$data;
  variables: EditDatasetExampleDialogMutation$variables;
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditDatasetExampleDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditDatasetExampleDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "5b7537a09214878e93804f19af2a3701",
    "id": null,
    "metadata": {},
    "name": "EditDatasetExampleDialogMutation",
    "operationKind": "mutation",
    "text": "mutation EditDatasetExampleDialogMutation(\n  $input: PatchDatasetExamplesInput!\n) {\n  patchDatasetExamples(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "e8c0c5c882dad5264f4f7ddcbe1777e1";

export default node;
