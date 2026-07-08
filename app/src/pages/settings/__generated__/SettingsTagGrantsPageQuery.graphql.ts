/**
 * @generated SignedSource<<18036e0ef70e9a2a4581a216ab784f3e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AccessObjectType = "DATASET" | "PROJECT" | "PROMPT";
export type AccessSubjectKind = "EVERYONE" | "GROUP" | "USER";
export type ObjectPermission = "EDIT" | "MANAGE_ACCESS" | "VIEW";
export type UserFilter = {
  value?: string | null;
};
export type SettingsTagGrantsPageQuery$variables = {
  userFilter?: UserFilter | null;
};
export type SettingsTagGrantsPageQuery$data = {
  readonly permissionSets: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<ObjectPermission>;
  }>;
  readonly tagGrants: ReadonlyArray<{
    readonly id: string;
    readonly objectType: AccessObjectType;
    readonly roleName: string | null;
    readonly subjectId: string | null;
    readonly subjectKind: AccessSubjectKind;
    readonly subjectName: string;
    readonly tagKey: string;
    readonly tagValue: string;
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
export type SettingsTagGrantsPageQuery = {
  response: SettingsTagGrantsPageQuery$data;
  variables: SettingsTagGrantsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "userFilter"
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
    "args": null,
    "concreteType": "TagAccessGrant",
    "kind": "LinkedField",
    "name": "tagGrants",
    "plural": true,
    "selections": [
      (v1/*: any*/),
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
        "name": "objectType",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "tagKey",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "tagValue",
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
  {
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
              (v1/*: any*/),
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
  {
    "alias": null,
    "args": null,
    "concreteType": "UserGroup",
    "kind": "LinkedField",
    "name": "userGroups",
    "plural": true,
    "selections": [
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "PermissionSet",
    "kind": "LinkedField",
    "name": "permissionSets",
    "plural": true,
    "selections": [
      (v1/*: any*/),
      (v2/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "permissions",
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
    "name": "SettingsTagGrantsPageQuery",
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsTagGrantsPageQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "97e2fa2b09da5eea6971e0214466579b",
    "id": null,
    "metadata": {},
    "name": "SettingsTagGrantsPageQuery",
    "operationKind": "query",
    "text": "query SettingsTagGrantsPageQuery(\n  $userFilter: UserFilter\n) {\n  tagGrants {\n    id\n    subjectKind\n    subjectId\n    subjectName\n    objectType\n    tagKey\n    tagValue\n    roleName\n  }\n  users(first: 25, filter: $userFilter) {\n    edges {\n      user: node {\n        id\n        username\n        email\n      }\n    }\n  }\n  userGroups {\n    id\n    name\n  }\n  permissionSets {\n    id\n    name\n    permissions\n  }\n}\n"
  }
};
})();

(node as any).hash = "c54e9641835e8ffc9ddf393206380b53";

export default node;
