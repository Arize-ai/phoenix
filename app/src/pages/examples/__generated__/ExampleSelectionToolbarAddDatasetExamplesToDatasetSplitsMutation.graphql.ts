/**
 * @generated SignedSource<<2774c04fd2b27271bf38a8056c893e14>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AddDatasetExamplesToDatasetSplitsInput = {
  datasetSplitIds: ReadonlyArray<string>;
  exampleIds: ReadonlyArray<string>;
};
export type ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation$variables = {
  input: AddDatasetExamplesToDatasetSplitsInput;
};
export type ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation$data = {
  readonly addDatasetExamplesToDatasetSplits: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation = {
  response: ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation$data;
  variables: ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation$variables;
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
    "concreteType": "AddDatasetExamplesToDatasetSplitsMutationPayload",
    "kind": "LinkedField",
    "name": "addDatasetExamplesToDatasetSplits",
    "plural": false,
    "selections": [
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
            "name": "__typename",
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
    "name": "ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "f4edd66fbe9c27175dcd7f6d6fe94957",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation",
    "operationKind": "mutation",
    "text": "mutation ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation(\n  $input: AddDatasetExamplesToDatasetSplitsInput!\n) {\n  addDatasetExamplesToDatasetSplits(input: $input) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "dd657896cf3c272a32f0b1959bb38217";

export default node;
