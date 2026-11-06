/**
 * @generated SignedSource<<34a0eaa773dbd043122df567f6c6b40c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TransferTracesButtonTransferMutation$variables = {
  projectId: string;
  traceIds: ReadonlyArray<string>;
};
export type TransferTracesButtonTransferMutation$data = {
  readonly transferTracesToProject: {
    readonly project: {
      readonly id: string;
      readonly name?: string;
    };
  };
};
export type TransferTracesButtonTransferMutation = {
  response: TransferTracesButtonTransferMutation$data;
  variables: TransferTracesButtonTransferMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "traceIds"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "projectId",
    "variableName": "projectId"
  },
  {
    "kind": "Variable",
    "name": "traceIds",
    "variableName": "traceIds"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TransferTracesButtonTransferMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "transferTracesToProject",
        "plural": false,
        "selections": [
          {
            "alias": "project",
            "args": (v2/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "TransferTracesButtonTransferMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "transferTracesToProject",
        "plural": false,
        "selections": [
          {
            "alias": "project",
            "args": (v2/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__typename",
                "storageKey": null
              },
              (v3/*:: as any*/),
              (v4/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ca0996306d7a238a1a37964b959dcf92",
    "id": null,
    "metadata": {},
    "name": "TransferTracesButtonTransferMutation",
    "operationKind": "mutation",
    "text": "mutation TransferTracesButtonTransferMutation(\n  $projectId: ID!\n  $traceIds: [ID!]!\n) {\n  transferTracesToProject(traceIds: $traceIds, projectId: $projectId) {\n    project: node(id: $projectId) {\n      __typename\n      id\n      ... on Project {\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "11306bf401c87cbfba767ee1ddd9dde5";

export default node;
