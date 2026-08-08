/**
 * @generated SignedSource<<17f884c1b274977936a2feedd09823e6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type applyPatchExperimentSnapshotQuery$variables = {
  experimentId: string;
};
export type applyPatchExperimentSnapshotQuery$data = {
  readonly experiment: {
    readonly __typename: "Experiment";
    readonly description: string | null;
    readonly metadata: any;
    readonly name: string;
    readonly updatedAt: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type applyPatchExperimentSnapshotQuery = {
  response: applyPatchExperimentSnapshotQuery$data;
  variables: applyPatchExperimentSnapshotQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "experimentId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
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
      "name": "metadata",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "updatedAt",
      "storageKey": null
    }
  ],
  "type": "Experiment",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "applyPatchExperimentSnapshotQuery",
    "selections": [
      {
        "alias": "experiment",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "applyPatchExperimentSnapshotQuery",
    "selections": [
      {
        "alias": "experiment",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
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
    ]
  },
  "params": {
    "cacheID": "325e0bd5cc0c371aa6fce727df61c515",
    "id": null,
    "metadata": {},
    "name": "applyPatchExperimentSnapshotQuery",
    "operationKind": "query",
    "text": "query applyPatchExperimentSnapshotQuery(\n  $experimentId: ID!\n) {\n  experiment: node(id: $experimentId) {\n    __typename\n    ... on Experiment {\n      name\n      description\n      metadata\n      updatedAt\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "eefd253dff1110e559861cef9cb11697";

export default node;
