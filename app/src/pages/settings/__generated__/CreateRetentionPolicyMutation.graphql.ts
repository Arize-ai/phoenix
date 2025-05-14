/**
 * @generated SignedSource<<14ff99f9c780016154a262126322ded7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreateProjectTraceRetentionPolicyInput = {
  addProjects?: ReadonlyArray<string> | null;
  cronExpression: string;
  name: string;
  rule: ProjectTraceRetentionRuleInput;
};
export type ProjectTraceRetentionRuleInput = {
  maxCount?: ProjectTraceRetentionRuleMaxCountInput | null;
  maxDays?: ProjectTraceRetentionRuleMaxDaysInput | null;
  maxDaysOrCount?: ProjectTraceRetentionRuleMaxDaysOrCountInput | null;
};
export type ProjectTraceRetentionRuleMaxDaysInput = {
  maxDays: number;
};
export type ProjectTraceRetentionRuleMaxCountInput = {
  maxCount: number;
};
export type ProjectTraceRetentionRuleMaxDaysOrCountInput = {
  maxCount: number;
  maxDays: number;
};
export type CreateRetentionPolicyMutation$variables = {
  connectionId: string;
  input: CreateProjectTraceRetentionPolicyInput;
};
export type CreateRetentionPolicyMutation$data = {
  readonly createProjectTraceRetentionPolicy: {
    readonly node: {
      readonly " $fragmentSpreads": FragmentRefs<"RetentionPoliciesTable_retentionPolicy">;
    };
  };
};
export type CreateRetentionPolicyMutation = {
  response: CreateRetentionPolicyMutation$data;
  variables: CreateRetentionPolicyMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
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
  "name": "maxCount",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxDays",
  "storageKey": null
},
v7 = [
  (v3/*: any*/),
  (v4/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cronExpression",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": null,
    "kind": "LinkedField",
    "name": "rule",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
        "storageKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v5/*: any*/)
        ],
        "type": "TraceRetentionRuleMaxCount",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v6/*: any*/)
        ],
        "type": "TraceRetentionRuleMaxDays",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v6/*: any*/),
          (v5/*: any*/)
        ],
        "type": "TraceRetentionRuleMaxDaysOrCount",
        "abstractKey": null
      }
    ],
    "storageKey": null
  },
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
              (v4/*: any*/),
              (v3/*: any*/)
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateRetentionPolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ProjectTraceRetentionPolicyMutationPayload",
        "kind": "LinkedField",
        "name": "createProjectTraceRetentionPolicy",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectTraceRetentionPolicy",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "RetentionPoliciesTable_retentionPolicy",
                "selections": (v7/*: any*/),
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "storageKey": null
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
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "CreateRetentionPolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ProjectTraceRetentionPolicyMutationPayload",
        "kind": "LinkedField",
        "name": "createProjectTraceRetentionPolicy",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectTraceRetentionPolicy",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": (v7/*: any*/),
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "node",
            "handleArgs": [
              {
                "items": [
                  {
                    "kind": "Variable",
                    "name": "connections.0",
                    "variableName": "connectionId"
                  }
                ],
                "kind": "ListValue",
                "name": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "ProjectTraceRetentionPolicyEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e0981aca4bdf8872ca8bb16aba1f9b5c",
    "id": null,
    "metadata": {},
    "name": "CreateRetentionPolicyMutation",
    "operationKind": "mutation",
    "text": "mutation CreateRetentionPolicyMutation(\n  $input: CreateProjectTraceRetentionPolicyInput!\n) {\n  createProjectTraceRetentionPolicy(input: $input) {\n    node {\n      ...RetentionPoliciesTable_retentionPolicy\n      id\n    }\n  }\n}\n\nfragment RetentionPoliciesTable_retentionPolicy on ProjectTraceRetentionPolicy {\n  id\n  name\n  cronExpression\n  rule {\n    __typename\n    ... on TraceRetentionRuleMaxCount {\n      maxCount\n    }\n    ... on TraceRetentionRuleMaxDays {\n      maxDays\n    }\n    ... on TraceRetentionRuleMaxDaysOrCount {\n      maxDays\n      maxCount\n    }\n  }\n  projects {\n    edges {\n      node {\n        name\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a111dbcaa8facd112289cd919cca3a3b";

export default node;
