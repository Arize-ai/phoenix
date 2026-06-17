/**
 * @generated SignedSource<<1bbb88a4a5458f01937f44131950ab1e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UserFilter = {
  value?: string | null;
};
export type SettingsGroupsPageQuery$variables = {
  userFilter?: UserFilter | null;
};
export type SettingsGroupsPageQuery$data = {
  readonly memberCandidates: {
    readonly edges: ReadonlyArray<{
      readonly user: {
        readonly email: string | null;
        readonly id: string;
        readonly username: string;
      };
    }>;
  };
  readonly userGroups: ReadonlyArray<{
    readonly groupId: number;
    readonly isLocal: boolean;
    readonly memberUserIds: ReadonlyArray<number>;
    readonly name: string;
    readonly provider: string;
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
export type SettingsGroupsPageQuery = {
  response: SettingsGroupsPageQuery$data;
  variables: SettingsGroupsPageQuery$variables;
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
  "name": "groupId",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "provider",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isLocal",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "memberUserIds",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = [
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
          (v6/*: any*/),
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
v8 = {
  "alias": null,
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 1000
    }
  ],
  "concreteType": "UserConnection",
  "kind": "LinkedField",
  "name": "users",
  "plural": false,
  "selections": (v7/*: any*/),
  "storageKey": "users(first:1000)"
},
v9 = {
  "alias": "memberCandidates",
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
  "selections": (v7/*: any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsGroupsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "UserGroup",
        "kind": "LinkedField",
        "name": "userGroups",
        "plural": true,
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/)
        ],
        "storageKey": null
      },
      (v8/*: any*/),
      (v9/*: any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsGroupsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "UserGroup",
        "kind": "LinkedField",
        "name": "userGroups",
        "plural": true,
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          (v6/*: any*/)
        ],
        "storageKey": null
      },
      (v8/*: any*/),
      (v9/*: any*/)
    ]
  },
  "params": {
    "cacheID": "16a90406863ded270489c75fd877eef2",
    "id": null,
    "metadata": {},
    "name": "SettingsGroupsPageQuery",
    "operationKind": "query",
    "text": "query SettingsGroupsPageQuery(\n  $userFilter: UserFilter\n) {\n  userGroups {\n    groupId\n    name\n    provider\n    isLocal\n    memberUserIds\n    id\n  }\n  users(first: 1000) {\n    edges {\n      user: node {\n        id\n        username\n        email\n      }\n    }\n  }\n  memberCandidates: users(first: 25, filter: $userFilter) {\n    edges {\n      user: node {\n        id\n        username\n        email\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "570c4c46d3dd66589ca00026a01a73a4";

export default node;
