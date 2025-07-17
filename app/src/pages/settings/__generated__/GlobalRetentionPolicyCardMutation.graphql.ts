/**
 * @generated SignedSource<<0daa8fa2fabd3c12756220ece8632a77>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PatchProjectTraceRetentionPolicyInput = {
  addProjects?: ReadonlyArray<string> | null;
  cronExpression?: string | null;
  id: string;
  name?: string | null;
  removeProjects?: ReadonlyArray<string> | null;
  rule?: ProjectTraceRetentionRuleInput | null;
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
export type GlobalRetentionPolicyCardMutation$variables = {
  input: PatchProjectTraceRetentionPolicyInput;
};
export type GlobalRetentionPolicyCardMutation$data = {
  readonly patchProjectTraceRetentionPolicy: {
    readonly node: {
      readonly id: string;
      readonly rule: {
        readonly __typename: "TraceRetentionRuleMaxDays";
        readonly maxDays: number;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      };
    };
  };
};
export type GlobalRetentionPolicyCardMutation = {
  response: GlobalRetentionPolicyCardMutation$data;
  variables: GlobalRetentionPolicyCardMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "ProjectTraceRetentionPolicyMutationPayload",
    "kind": "LinkedField",
    "name": "patchProjectTraceRetentionPolicy",
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
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
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
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "maxDays",
                    "storageKey": null
                  }
                ],
                "type": "TraceRetentionRuleMaxDays",
                "abstractKey": null
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
    "name": "GlobalRetentionPolicyCardMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "GlobalRetentionPolicyCardMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "096e3d4c546229fc771e14be03b168a3",
    "id": null,
    "metadata": {},
    "name": "GlobalRetentionPolicyCardMutation",
    "operationKind": "mutation",
    "text": "mutation GlobalRetentionPolicyCardMutation(\n  $input: PatchProjectTraceRetentionPolicyInput!\n) {\n  patchProjectTraceRetentionPolicy(input: $input) {\n    node {\n      id\n      rule {\n        __typename\n        ... on TraceRetentionRuleMaxDays {\n          maxDays\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d1757c8159d448039635f1fe035803c4";

export default node;
