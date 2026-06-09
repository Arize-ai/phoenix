/**
 * @generated SignedSource<<a3978420650f34abd33e7c4779f9541e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetDatasetExampleSplitsInput = {
  datasetSplitIds: ReadonlyArray<string>;
  exampleId: string;
};
export type setDatasetExampleSplitsToolMutation$variables = {
  input: SetDatasetExampleSplitsInput;
};
export type setDatasetExampleSplitsToolMutation$data = {
  readonly setDatasetExampleSplits: {
    readonly example: {
      readonly id: string;
    };
  };
};
export type setDatasetExampleSplitsToolMutation = {
  response: setDatasetExampleSplitsToolMutation$data;
  variables: setDatasetExampleSplitsToolMutation$variables;
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
    "concreteType": "SetDatasetExampleSplitsMutationPayload",
    "kind": "LinkedField",
    "name": "setDatasetExampleSplits",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetExample",
        "kind": "LinkedField",
        "name": "example",
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
    "name": "setDatasetExampleSplitsToolMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "setDatasetExampleSplitsToolMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "f4aed67890b1e4501feae797c080dddd",
    "id": null,
    "metadata": {},
    "name": "setDatasetExampleSplitsToolMutation",
    "operationKind": "mutation",
    "text": "mutation setDatasetExampleSplitsToolMutation(\n  $input: SetDatasetExampleSplitsInput!\n) {\n  setDatasetExampleSplits(input: $input) {\n    example {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "85bb39a0b17cf9d2bad43361749b4722";

export default node;
