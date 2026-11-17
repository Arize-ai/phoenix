/**
 * @generated SignedSource<<19aec5b1d2a888633abd03614ab3c518>>
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
export type ProjectActionMenuClearMutation$variables = {
  input: ClearProjectInput;
  projectId: string;
};
export type ProjectActionMenuClearMutation$data = {
  readonly clearProject: {
    readonly node: {
      readonly id?: string;
      readonly isClearingTraces?: boolean;
    };
  };
};
export type ProjectActionMenuClearMutation = {
  response: ProjectActionMenuClearMutation$data;
  variables: ProjectActionMenuClearMutation$variables;
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
    "name": "ProjectActionMenuClearMutation",
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
    "name": "ProjectActionMenuClearMutation",
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
    "cacheID": "768ddcf3274f77f93021e719dd2bb5d7",
    "id": null,
    "metadata": {},
    "name": "ProjectActionMenuClearMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectActionMenuClearMutation(\n  $input: ClearProjectInput!\n  $projectId: ID!\n) {\n  clearProject(input: $input) {\n    node(id: $projectId) {\n      __typename\n      ... on Project {\n        id\n        isClearingTraces\n      }\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ab8d1edc94d0ae08c38195757433d0b6";

export default node;
