/**
 * @generated SignedSource<<db33516f1cd9fd3d700aebc46d13c84f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateProjectInput = {
  description?: string | null;
  gradientEndColor?: string | null;
  gradientStartColor?: string | null;
  name: string;
};
export type NewProjectButtonCreateProjectMutation$variables = {
  input: CreateProjectInput;
};
export type NewProjectButtonCreateProjectMutation$data = {
  readonly createProject: {
    readonly project: {
      readonly gradientEndColor: string;
      readonly gradientStartColor: string;
      readonly id: string;
      readonly name: string;
    };
    readonly query: {
      readonly projects: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly id: string;
            readonly name: string;
          };
        }>;
      };
    };
  };
};
export type NewProjectButtonCreateProjectMutation = {
  response: NewProjectButtonCreateProjectMutation$data;
  variables: NewProjectButtonCreateProjectMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "ProjectMutationPayload",
    "kind": "LinkedField",
    "name": "createProject",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Project",
        "kind": "LinkedField",
        "name": "project",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "gradientStartColor",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "gradientEndColor",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "query",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": [
              {
                "kind": "Literal",
                "name": "first",
                "value": 50
              }
            ],
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
                      (v1/*: any*/),
                      (v2/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": "projects(first:50)"
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
    "name": "NewProjectButtonCreateProjectMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewProjectButtonCreateProjectMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "c05cdc005a38ad4285300f8f895ed799",
    "id": null,
    "metadata": {},
    "name": "NewProjectButtonCreateProjectMutation",
    "operationKind": "mutation",
    "text": "mutation NewProjectButtonCreateProjectMutation(\n  $input: CreateProjectInput!\n) {\n  createProject(input: $input) {\n    project {\n      id\n      name\n      gradientStartColor\n      gradientEndColor\n    }\n    query {\n      projects(first: 50) {\n        edges {\n          node {\n            id\n            name\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e39b2dd1009edc14856a735fd1b9d01b";

export default node;
