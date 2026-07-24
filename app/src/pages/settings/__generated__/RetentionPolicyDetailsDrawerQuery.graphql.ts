/**
 * @generated SignedSource<<80bcb619a4f5eb4902fb72cead5de6b3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RetentionPolicyDetailsDrawerQuery$variables = {
  policyId: string;
};
export type RetentionPolicyDetailsDrawerQuery$data = {
  readonly node: {
    readonly __typename: "ProjectTraceRetentionPolicy";
    readonly cronExpression: string;
    readonly id: string;
    readonly name: string;
    readonly projects: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly gradientEndColor: string;
          readonly gradientStartColor: string;
          readonly id: string;
          readonly name: string;
        };
      }>;
    };
    readonly rule: {
      readonly __typename: "TraceRetentionRuleMaxCount";
      readonly maxCount: number;
    } | {
      readonly __typename: "TraceRetentionRuleMaxDays";
      readonly maxDays: number;
    } | {
      readonly __typename: "TraceRetentionRuleMaxDaysOrCount";
      readonly maxCount: number;
      readonly maxDays: number;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type RetentionPolicyDetailsDrawerQuery = {
  response: RetentionPolicyDetailsDrawerQuery$data;
  variables: RetentionPolicyDetailsDrawerQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "policyId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "policyId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cronExpression",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxDays",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "rule",
  "plural": false,
  "selections": [
    (v2/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v6/*:: as any*/)
      ],
      "type": "TraceRetentionRuleMaxCount",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v7/*:: as any*/)
      ],
      "type": "TraceRetentionRuleMaxDays",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v7/*:: as any*/),
        (v6/*:: as any*/)
      ],
      "type": "TraceRetentionRuleMaxDaysOrCount",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 1000
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
            (v3/*:: as any*/),
            (v4/*:: as any*/),
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
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": "projects(first:1000)"
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RetentionPolicyDetailsDrawerQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/)
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "RetentionPolicyDetailsDrawerQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/)
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
    "cacheID": "98c5f1481daf9b73540269cfb28eaf9d",
    "id": null,
    "metadata": {},
    "name": "RetentionPolicyDetailsDrawerQuery",
    "operationKind": "query",
    "text": "query RetentionPolicyDetailsDrawerQuery(\n  $policyId: ID!\n) {\n  node(id: $policyId) {\n    __typename\n    ... on ProjectTraceRetentionPolicy {\n      id\n      name\n      cronExpression\n      rule {\n        __typename\n        ... on TraceRetentionRuleMaxCount {\n          maxCount\n        }\n        ... on TraceRetentionRuleMaxDays {\n          maxDays\n        }\n        ... on TraceRetentionRuleMaxDaysOrCount {\n          maxDays\n          maxCount\n        }\n      }\n      projects(first: 1000) {\n        edges {\n          node {\n            id\n            name\n            gradientStartColor\n            gradientEndColor\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "0fceb1360d9248b0dc6ab8b6f7426188";

export default node;
