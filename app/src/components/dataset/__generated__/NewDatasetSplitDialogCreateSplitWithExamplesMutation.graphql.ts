/**
 * @generated SignedSource<<e5f508624b531d7a94697606fa5aa033>>
 * @lightSyntaxTransform
 * @nogrep
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
export type NewDatasetSplitDialogCreateSplitWithExamplesMutation$variables = {
  connections: ReadonlyArray<string>;
  input: CreateDatasetSplitWithExamplesInput;
};
export type NewDatasetSplitDialogCreateSplitWithExamplesMutation$data = {
  readonly createDatasetSplitWithExamples: {
    readonly datasetSplit: {
      readonly id: string;
      readonly name: string;
    };
    readonly examples: ReadonlyArray<{
      readonly datasetSplits: ReadonlyArray<{
        readonly color: string;
        readonly id: string;
        readonly name: string;
      }>;
      readonly id: string;
    }>;
  };
};
export type NewDatasetSplitDialogCreateSplitWithExamplesMutation = {
  response: NewDatasetSplitDialogCreateSplitWithExamplesMutation$data;
  variables: NewDatasetSplitDialogCreateSplitWithExamplesMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetSplit",
  "kind": "LinkedField",
  "name": "datasetSplit",
  "plural": false,
  "selections": [
    (v3/*: any*/),
    (v4/*: any*/)
  ],
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetExample",
  "kind": "LinkedField",
  "name": "examples",
  "plural": true,
  "selections": [
    (v3/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetSplit",
      "kind": "LinkedField",
      "name": "datasetSplits",
      "plural": true,
      "selections": [
        (v3/*: any*/),
        (v4/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "color",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "NewDatasetSplitDialogCreateSplitWithExamplesMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DatasetSplitMutationPayloadWithExamples",
        "kind": "LinkedField",
        "name": "createDatasetSplitWithExamples",
        "plural": false,
        "selections": [
          (v5/*: any*/),
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "NewDatasetSplitDialogCreateSplitWithExamplesMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DatasetSplitMutationPayloadWithExamples",
        "kind": "LinkedField",
        "name": "createDatasetSplitWithExamples",
        "plural": false,
        "selections": [
          (v5/*: any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "datasetSplit",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "DatasetSplitEdge"
              }
            ]
          },
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e746e6264dc039ea0a907e8381a3e8d7",
    "id": null,
    "metadata": {},
    "name": "NewDatasetSplitDialogCreateSplitWithExamplesMutation",
    "operationKind": "mutation",
    "text": "mutation NewDatasetSplitDialogCreateSplitWithExamplesMutation(\n  $input: CreateDatasetSplitWithExamplesInput!\n) {\n  createDatasetSplitWithExamples(input: $input) {\n    datasetSplit {\n      id\n      name\n    }\n    examples {\n      id\n      datasetSplits {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "eb1ee991af123fd14dfe9b42b78728f3";

export default node;
