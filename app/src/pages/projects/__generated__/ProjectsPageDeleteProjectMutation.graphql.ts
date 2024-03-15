/**
 * @generated SignedSource<<98281a474a34a86419cf672c98fd1091>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectsPageDeleteProjectMutation$variables = {
  projectId: string;
};
export type ProjectsPageDeleteProjectMutation$data = {
  readonly deleteProject: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectsPageProjectsFragment">;
  };
};
export type ProjectsPageDeleteProjectMutation = {
  response: ProjectsPageDeleteProjectMutation$data;
  variables: ProjectsPageDeleteProjectMutation$variables;
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
    "name": "ProjectsPageDeleteProjectMutation",
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
    "name": "ProjectsPageDeleteProjectMutation",
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
    "cacheID": "48a81807124eb089edd4989f156f7fb7",
    "id": null,
    "metadata": {},
    "name": "ProjectsPageDeleteProjectMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectsPageDeleteProjectMutation(\n  $projectId: GlobalID!\n) {\n  deleteProject(id: $projectId) {\n    ...ProjectsPageProjectsFragment\n  }\n}\n\nfragment ProjectsPageProjectsFragment on Query {\n  projects {\n    edges {\n      project: node {\n        id\n        name\n        traceCount\n        endTime\n        latencyMsP50\n        tokenCountTotal\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "313c67696e40d718f788984d0dd56bfd";

export default node;
