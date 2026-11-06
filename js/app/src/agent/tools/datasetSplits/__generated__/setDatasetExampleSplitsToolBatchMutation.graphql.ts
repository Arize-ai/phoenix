/**
 * @generated SignedSource<<8f2f1e47fb0ed807b8a51a2ca7d2418f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetDatasetExamplesSplitsInput = {
  datasetId?: string | null;
  datasetSplitIds: ReadonlyArray<string>;
  exampleIds: ReadonlyArray<string>;
};
export type setDatasetExampleSplitsToolBatchMutation$variables = {
  input: SetDatasetExamplesSplitsInput;
};
export type setDatasetExampleSplitsToolBatchMutation$data = {
  readonly setDatasetExamplesSplits: {
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
export type setDatasetExampleSplitsToolBatchMutation = {
  response: setDatasetExampleSplitsToolBatchMutation$data;
  variables: setDatasetExampleSplitsToolBatchMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "SetDatasetExamplesSplitsMutationPayload",
    "kind": "LinkedField",
    "name": "setDatasetExamplesSplits",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetExample",
        "kind": "LinkedField",
        "name": "examples",
        "plural": true,
        "selections": [
          (v1/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetSplit",
            "kind": "LinkedField",
            "name": "datasetSplits",
            "plural": true,
            "selections": [
              (v1/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              },
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
    "name": "setDatasetExampleSplitsToolBatchMutation",
    "selections": (v2/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "setDatasetExampleSplitsToolBatchMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "a971fea6dd654568e67dab7982dd4f6f",
    "id": null,
    "metadata": {},
    "name": "setDatasetExampleSplitsToolBatchMutation",
    "operationKind": "mutation",
    "text": "mutation setDatasetExampleSplitsToolBatchMutation(\n  $input: SetDatasetExamplesSplitsInput!\n) {\n  setDatasetExamplesSplits(input: $input) {\n    examples {\n      id\n      datasetSplits {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "98ffab15757d1e4c3ab6c2b3875dccc3";

export default node;
