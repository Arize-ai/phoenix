/**
 * @generated SignedSource<<f9744a20061fdc3d45a6b22965a982fa>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectActionsDropdownMutation$variables = {
  projectId: string;
};
export type ProjectActionsDropdownMutation$data = {
  readonly deleteProject: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectsPageProjectsFragment">;
  };
};
export type ProjectActionsDropdownMutation = {
  response: ProjectActionsDropdownMutation$data;
  variables: ProjectActionsDropdownMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectActionsDropdownMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "deleteProject",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "ProjectsPageProjectsFragment"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectActionsDropdownMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "deleteProject",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectConnection",
            "kind": "LinkedField",
            "name": "projects",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ProjectEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": "project",
                    "args": null,
                    "concreteType": "Project",
                    "kind": "LinkedField",
                    "name": "node",
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
                        "name": "traceCount",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "endTime",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "latencyMsP50",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "tokenCountTotal",
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
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "9ae75173d5b84e4029b9577f8dd2f063",
    "id": null,
    "metadata": {},
    "name": "ProjectActionsDropdownMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectActionsDropdownMutation(\n  $projectId: GlobalID!\n) {\n  deleteProject(id: $projectId) {\n    ...ProjectsPageProjectsFragment\n  }\n}\n\nfragment ProjectsPageProjectsFragment on Query {\n  projects {\n    edges {\n      project: node {\n        id\n        name\n        traceCount\n        endTime\n        latencyMsP50\n        tokenCountTotal\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "72ed03bfa02fbf24d95357e85fc35c06";

export default node;
