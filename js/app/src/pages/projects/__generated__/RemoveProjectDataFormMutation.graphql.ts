/**
 * @generated SignedSource<<d027e675fd6600d5a48f89f6f22772a3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearProjectInput = {
  endTime?: string | null;
  id: string;
};
export type RemoveProjectDataFormMutation$variables = {
  input: ClearProjectInput;
  projectId: string;
};
export type RemoveProjectDataFormMutation$data = {
  readonly clearProject: {
    readonly node: {
      readonly id?: string;
      readonly isClearingTraces?: boolean;
    };
  };
};
export type RemoveProjectDataFormMutation = {
  response: RemoveProjectDataFormMutation$data;
  variables: RemoveProjectDataFormMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isClearingTraces",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RemoveProjectDataFormMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "clearProject",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": (v2/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/)
                ],
                "type": "Project",
                "abstractKey": null
              }
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
    "name": "RemoveProjectDataFormMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "clearProject",
        "plural": false,
        "selections": [
          {
            "alias": null,
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
              {
                "kind": "InlineFragment",
                "selections": [
                  (v4/*:: as any*/)
                ],
                "type": "Project",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2f57c66c74ec6e91e91a5a32c3f85381",
    "id": null,
    "metadata": {},
    "name": "RemoveProjectDataFormMutation",
    "operationKind": "mutation",
    "text": "mutation RemoveProjectDataFormMutation(\n  $input: ClearProjectInput!\n  $projectId: ID!\n) {\n  clearProject(input: $input) {\n    node(id: $projectId) {\n      __typename\n      ... on Project {\n        id\n        isClearingTraces\n      }\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6f6b303a392b6c48c4504aa8d574ddee";

export default node;
