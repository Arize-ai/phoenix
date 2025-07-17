/**
 * @generated SignedSource<<a7874b4d031f31a55b4210d425eafd99>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GlobalRetentionPolicyCardQuery$variables = Record<PropertyKey, never>;
export type GlobalRetentionPolicyCardQuery$data = {
  readonly defaultProjectTraceRetentionPolicy: {
    readonly cronExpression: string;
    readonly id: string;
    readonly name: string;
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
export type GlobalRetentionPolicyCardQuery = {
  response: GlobalRetentionPolicyCardQuery$data;
  variables: GlobalRetentionPolicyCardQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "ProjectTraceRetentionPolicy",
    "kind": "LinkedField",
    "name": "defaultProjectTraceRetentionPolicy",
    "plural": false,
    "selections": [
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
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
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
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "GlobalRetentionPolicyCardQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "GlobalRetentionPolicyCardQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "cc26cab6fcf5acfdf11abdb30f7f937f",
    "id": null,
    "metadata": {},
    "name": "GlobalRetentionPolicyCardQuery",
    "operationKind": "query",
    "text": "query GlobalRetentionPolicyCardQuery {\n  defaultProjectTraceRetentionPolicy {\n    cronExpression\n    id\n    name\n    rule {\n      __typename\n      ... on TraceRetentionRuleMaxDays {\n        maxDays\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "15a513ac6f9c30b739810e2e18d6f0ab";

export default node;
