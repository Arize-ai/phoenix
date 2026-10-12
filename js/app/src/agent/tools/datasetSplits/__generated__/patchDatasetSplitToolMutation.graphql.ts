/**
 * @generated SignedSource<<09734a7c1271b446b40af0176954686a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PatchDatasetSplitInput = {
  color?: string | null;
  datasetSplitId: string;
  description?: string | null;
  metadata?: any | null;
  name?: string | null;
};
export type patchDatasetSplitToolMutation$variables = {
  input: PatchDatasetSplitInput;
};
export type patchDatasetSplitToolMutation$data = {
  readonly patchDatasetSplit: {
    readonly datasetSplit: {
      readonly color: string;
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
    };
  };
};
export type patchDatasetSplitToolMutation = {
  response: patchDatasetSplitToolMutation$data;
  variables: patchDatasetSplitToolMutation$variables;
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
    "concreteType": "DatasetSplitMutationPayload",
    "kind": "LinkedField",
    "name": "patchDatasetSplit",
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "description",
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "patchDatasetSplitToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "patchDatasetSplitToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "432a39964e7fc79408773f6e17bb182d",
    "id": null,
    "metadata": {},
    "name": "patchDatasetSplitToolMutation",
    "operationKind": "mutation",
    "text": "mutation patchDatasetSplitToolMutation(\n  $input: PatchDatasetSplitInput!\n) {\n  patchDatasetSplit(input: $input) {\n    datasetSplit {\n      id\n      name\n      description\n      color\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a796a80f7dd8025734c89e64e6c600e7";

export default node;
