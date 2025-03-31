/**
 * @generated SignedSource<<f64907e26c3af3145c18c55f654a4de9>>
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
    "cacheID": "852ea7b911946a5fde4a767be8034066",
    "id": null,
    "metadata": {},
    "name": "GlobalRetentionPolicyCardMutation",
    "operationKind": "mutation",
    "text": "mutation GlobalRetentionPolicyCardMutation(\n  $input: PatchProjectTraceRetentionPolicyInput!\n) {\n  patchProjectTraceRetentionPolicy(input: $input) {\n    node {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6250488254468492dfb10d0540da68bc";

export default node;
