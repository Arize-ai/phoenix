/**
 * @generated SignedSource<<0ffd79c0a25384a9d41b4105d71e9db6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type ProjectsPageDeleteProjectMutation$variables = {
  id: string;
};
export type ProjectsPageDeleteProjectMutation$data = {
  readonly deleteProject: {
    readonly projects: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly __typename: "Project";
        };
      }>;
    };
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
    "name": "id"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
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
                "alias": null,
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
                    "name": "__typename",
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectsPageDeleteProjectMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectsPageDeleteProjectMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "796e676fbca6de3d42be569aeff57567",
    "id": null,
    "metadata": {},
    "name": "ProjectsPageDeleteProjectMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectsPageDeleteProjectMutation(\n  $id: GlobalID!\n) {\n  deleteProject(id: $id) {\n    projects {\n      edges {\n        node {\n          __typename\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2837d4beb4ec73c91c95b347be77dac6";

export default node;
