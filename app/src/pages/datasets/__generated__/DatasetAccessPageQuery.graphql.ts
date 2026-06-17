/**
 * @generated SignedSource<<e2e8939b3d15a134a5471921e53859bc>>
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
export type DatasetAccessPageQuery$variables = {
  datasetId: string;
  userFilter?: UserFilter | null;
};
export type DatasetAccessPageQuery$data = {
  readonly dataset: {
    readonly accessGrants?: ReadonlyArray<{
      readonly roleId: string | null;
      readonly roleName: string;
      readonly subjectId: string | null;
      readonly subjectKind: AccessSubjectKind;
      readonly subjectName: string;
    }>;
    readonly id?: string;
  };
  readonly permissionSets: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<ObjectPermission>;
  }>;
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
export type DatasetAccessPageQuery = {
  response: DatasetAccessPageQuery$data;
  variables: DatasetAccessPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
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
    "variableName": "datasetId"
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
      "variableName": "datasetId"
    },
    {
      "kind": "Literal",
      "name": "objectType",
      "value": "DATASET"
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
    "name": "DatasetAccessPageQuery",
    "selections": [
      {
        "alias": "dataset",
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
            "type": "Dataset",
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
    "name": "DatasetAccessPageQuery",
    "selections": [
      {
        "alias": "dataset",
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
            "type": "Dataset",
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
    "cacheID": "67886716fb99c0c1c3699c3ed315a944",
    "id": null,
    "metadata": {},
    "name": "DatasetAccessPageQuery",
    "operationKind": "query",
    "text": "query DatasetAccessPageQuery(\n  $datasetId: ID!\n  $userFilter: UserFilter\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      id\n      accessGrants {\n        subjectKind\n        subjectId\n        subjectName\n        roleId\n        roleName\n      }\n    }\n    id\n  }\n  users(first: 25, filter: $userFilter) {\n    edges {\n      user: node {\n        id\n        username\n        email\n      }\n    }\n  }\n  userGroups {\n    id\n    name\n  }\n  permissionSets {\n    id\n    name\n    permissions\n  }\n  resourceTags(objectType: DATASET, objectId: $datasetId) {\n    key\n    value\n  }\n}\n"
  }
};
})();

(node as any).hash = "bcbb5e9c8f11375c3b3ddfd31d2167c0";

export default node;
