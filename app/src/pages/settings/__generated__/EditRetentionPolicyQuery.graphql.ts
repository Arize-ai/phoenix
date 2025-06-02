/**
 * @generated SignedSource<<d6ecf29c8afd168a0030b468ffcdfd1e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EditRetentionPolicyQuery$variables = {
  id: string;
};
export type EditRetentionPolicyQuery$data = {
  readonly retentionPolicy: {
    readonly cronExpression?: string;
    readonly id?: string;
    readonly name?: string;
    readonly rule?: {
      readonly maxCount?: number;
      readonly maxDays?: number;
    };
  };
};
export type EditRetentionPolicyQuery = {
  response: EditRetentionPolicyQuery$data;
  variables: EditRetentionPolicyQuery$variables;
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
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
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
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cronExpression",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
  "storageKey": null
},
v6 = {
  "kind": "InlineFragment",
  "selections": [
    (v5/*: any*/)
  ],
  "type": "TraceRetentionRuleMaxCount",
  "abstractKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxDays",
  "storageKey": null
},
v8 = {
  "kind": "InlineFragment",
  "selections": [
    (v7/*: any*/)
  ],
  "type": "TraceRetentionRuleMaxDays",
  "abstractKey": null
},
v9 = {
  "kind": "InlineFragment",
  "selections": [
    (v7/*: any*/),
    (v5/*: any*/)
  ],
  "type": "TraceRetentionRuleMaxDaysOrCount",
  "abstractKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditRetentionPolicyQuery",
    "selections": [
      {
        "alias": "retentionPolicy",
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
              (v3/*: any*/),
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "rule",
                "plural": false,
                "selections": [
                  (v6/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "ProjectTraceRetentionPolicy",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditRetentionPolicyQuery",
    "selections": [
      {
        "alias": "retentionPolicy",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v10/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "rule",
                "plural": false,
                "selections": [
                  (v10/*: any*/),
                  (v6/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "ProjectTraceRetentionPolicy",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3fe25e8ebefb19f49627fe187ba0eb5d",
    "id": null,
    "metadata": {},
    "name": "EditRetentionPolicyQuery",
    "operationKind": "query",
    "text": "query EditRetentionPolicyQuery(\n  $id: ID!\n) {\n  retentionPolicy: node(id: $id) {\n    __typename\n    ... on ProjectTraceRetentionPolicy {\n      id\n      name\n      cronExpression\n      rule {\n        __typename\n        ... on TraceRetentionRuleMaxCount {\n          maxCount\n        }\n        ... on TraceRetentionRuleMaxDays {\n          maxDays\n        }\n        ... on TraceRetentionRuleMaxDaysOrCount {\n          maxDays\n          maxCount\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "3bf941d551e8fb7a6940d8774075be73";

export default node;
