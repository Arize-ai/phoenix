/**
 * @generated SignedSource<<c3f80567c546bcbe9b5e10c47aca476c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AccessSubjectKind = "EVERYONE" | "GROUP" | "USER";
export type ObjectPermission = "EDIT" | "MANAGE_ACCESS" | "VIEW";
export type UserFilter = {
  value?: string | null;
};
export type ProjectAccessPageQuery$variables = {
  projectId: string;
  userFilter?: UserFilter | null;
};
export type ProjectAccessPageQuery$data = {
  readonly permissionSets: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<ObjectPermission>;
  }>;
  readonly project: {
    readonly accessGrants?: ReadonlyArray<{
      readonly roleId: string | null;
      readonly roleName: string;
      readonly subjectId: string | null;
      readonly subjectKind: AccessSubjectKind;
      readonly subjectName: string;
    }>;
    readonly id?: string;
  };
  readonly resourceTags: ReadonlyArray<{
    readonly key: string;
    readonly value: string;
  }>;
  readonly userGroups: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly users: {
    readonly edges: ReadonlyArray<{
      readonly user: {
        readonly email: string | null;
        readonly id: string;
        readonly username: string;
      };
    }>;
  };
};
export type ProjectAccessPageQuery = {
  response: ProjectAccessPageQuery$data;
  variables: ProjectAccessPageQuery$variables;
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
    "name": "userFilter"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "AccessGrant",
  "kind": "LinkedField",
  "name": "accessGrants",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "subjectKind",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "subjectId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "subjectName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "roleId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "roleName",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "filter",
      "variableName": "userFilter"
    },
    {
      "kind": "Literal",
      "name": "first",
      "value": 25
    }
  ],
  "concreteType": "UserConnection",
  "kind": "LinkedField",
  "name": "users",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "UserEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": "user",
          "args": null,
          "concreteType": "User",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v2/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "username",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "email",
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
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "UserGroup",
  "kind": "LinkedField",
  "name": "userGroups",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    (v5/*: any*/)
  ],
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "PermissionSet",
  "kind": "LinkedField",
  "name": "permissionSets",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    (v5/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "permissions",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "objectId",
      "variableName": "projectId"
    },
    {
      "kind": "Literal",
      "name": "objectType",
      "value": "PROJECT"
    }
  ],
  "concreteType": "ResourceTag",
  "kind": "LinkedField",
  "name": "resourceTags",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "key",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "value",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectAccessPageQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/)
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      (v4/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/),
      (v8/*: any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectAccessPageQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
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
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/)
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      (v4/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/),
      (v8/*: any*/)
    ]
  },
  "params": {
    "cacheID": "f189de63fd0ab404d78ceca4deb2e9d4",
    "id": null,
    "metadata": {},
    "name": "ProjectAccessPageQuery",
    "operationKind": "query",
    "text": "query ProjectAccessPageQuery(\n  $projectId: ID!\n  $userFilter: UserFilter\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      id\n      accessGrants {\n        subjectKind\n        subjectId\n        subjectName\n        roleId\n        roleName\n      }\n    }\n    id\n  }\n  users(first: 25, filter: $userFilter) {\n    edges {\n      user: node {\n        id\n        username\n        email\n      }\n    }\n  }\n  userGroups {\n    id\n    name\n  }\n  permissionSets {\n    id\n    name\n    permissions\n  }\n  resourceTags(objectType: PROJECT, objectId: $projectId) {\n    key\n    value\n  }\n}\n"
  }
};
})();

(node as any).hash = "cf8d18fd67c7073f050b7dc8cbb51127";

export default node;
