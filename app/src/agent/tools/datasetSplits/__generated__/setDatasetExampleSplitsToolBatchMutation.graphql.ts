/**
 * @generated SignedSource<<81e50a969c32cccf2c400dabe596fa10>>
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "setDatasetExampleSplitsToolBatchMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "setDatasetExampleSplitsToolBatchMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "806d9cc072a89701b34c31b14e9b9a5b",
    "id": null,
    "metadata": {},
    "name": "setDatasetExampleSplitsToolBatchMutation",
    "operationKind": "mutation",
    "text": "mutation setDatasetExampleSplitsToolBatchMutation(\n  $input: SetDatasetExamplesSplitsInput!\n) {\n  setDatasetExamplesSplits(input: $input) {\n    examples {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7bb4c01088227966315047ce0260d78e";

export default node;
