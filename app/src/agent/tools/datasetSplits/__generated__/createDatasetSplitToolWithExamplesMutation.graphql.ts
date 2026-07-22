/**
 * @generated SignedSource<<d16fd18f46f47686f5e70a9241f91e04>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateDatasetSplitWithExamplesInput = {
  color: string;
  description?: string | null;
  exampleIds: ReadonlyArray<string>;
  metadata?: any | null;
  name: string;
};
export type createDatasetSplitToolWithExamplesMutation$variables = {
  input: CreateDatasetSplitWithExamplesInput;
};
export type createDatasetSplitToolWithExamplesMutation$data = {
  readonly createDatasetSplitWithExamples: {
    readonly datasetSplit: {
      readonly id: string;
      readonly name: string;
    };
  };
};
export type createDatasetSplitToolWithExamplesMutation = {
  response: createDatasetSplitToolWithExamplesMutation$data;
  variables: createDatasetSplitToolWithExamplesMutation$variables;
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
    "concreteType": "DatasetSplitMutationPayloadWithExamples",
    "kind": "LinkedField",
    "name": "createDatasetSplitWithExamples",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetSplit",
        "kind": "LinkedField",
        "name": "datasetSplit",
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
    "name": "createDatasetSplitToolWithExamplesMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "createDatasetSplitToolWithExamplesMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "44118ba800f9a54a2ac07b37f6e47222",
    "id": null,
    "metadata": {},
    "name": "createDatasetSplitToolWithExamplesMutation",
    "operationKind": "mutation",
    "text": "mutation createDatasetSplitToolWithExamplesMutation(\n  $input: CreateDatasetSplitWithExamplesInput!\n) {\n  createDatasetSplitWithExamples(input: $input) {\n    datasetSplit {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7cd1f6a222dbe15f31e28b2bcdbae98a";

export default node;
