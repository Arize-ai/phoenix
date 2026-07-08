/**
 * @generated SignedSource<<12b681e34998c3af668996f3151b5eef>>
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
export type PromptAccessPageQuery$variables = {
  promptId: string;
  userFilter?: UserFilter | null;
};
export type PromptAccessPageQuery$data = {
  readonly permissionSets: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<ObjectPermission>;
  }>;
  readonly prompt: {
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
export type PromptAccessPageQuery = {
  response: PromptAccessPageQuery$data;
  variables: PromptAccessPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
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
    "variableName": "promptId"
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
      "variableName": "promptId"
    },
    {
      "kind": "Literal",
      "name": "objectType",
      "value": "PROMPT"
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
    "name": "PromptAccessPageQuery",
    "selections": [
      {
        "alias": "prompt",
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
            "type": "Prompt",
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
    "name": "PromptAccessPageQuery",
    "selections": [
      {
        "alias": "prompt",
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
            "type": "Prompt",
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
    "cacheID": "4b24c24c05ef0620a7dd39a6367cb3d4",
    "id": null,
    "metadata": {},
    "name": "PromptAccessPageQuery",
    "operationKind": "query",
    "text": "query PromptAccessPageQuery(\n  $promptId: ID!\n  $userFilter: UserFilter\n) {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      id\n      accessGrants {\n        subjectKind\n        subjectId\n        subjectName\n        roleId\n        roleName\n      }\n    }\n    id\n  }\n  users(first: 25, filter: $userFilter) {\n    edges {\n      user: node {\n        id\n        username\n        email\n      }\n    }\n  }\n  userGroups {\n    id\n    name\n  }\n  permissionSets {\n    id\n    name\n    permissions\n  }\n  resourceTags(objectType: PROMPT, objectId: $promptId) {\n    key\n    value\n  }\n}\n"
  }
};
})();

(node as any).hash = "2e9fb717fb5bbb57254889b06aeba5ec";

export default node;
