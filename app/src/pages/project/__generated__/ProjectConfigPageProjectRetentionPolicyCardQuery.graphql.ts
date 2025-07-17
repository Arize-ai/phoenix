/**
 * @generated SignedSource<<104fcd9d6a5ce09881a6124599ef673e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectConfigPageProjectRetentionPolicyCardQuery$variables = {
  id: string;
};
export type ProjectConfigPageProjectRetentionPolicyCardQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_projectRetentionPolicyCard">;
  };
};
export type ProjectConfigPageProjectRetentionPolicyCardQuery = {
  response: ProjectConfigPageProjectRetentionPolicyCardQuery$data;
  variables: ProjectConfigPageProjectRetentionPolicyCardQuery$variables;
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
  "name": "maxDays",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectConfigPageProjectRetentionPolicyCardQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "ProjectConfigPage_projectRetentionPolicyCard"
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
    "name": "ProjectConfigPageProjectRetentionPolicyCardQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ProjectTraceRetentionPolicy",
                "kind": "LinkedField",
                "name": "traceRetentionPolicy",
                "plural": false,
                "selections": [
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
                      (v2/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v5/*: any*/)
                        ],
                        "type": "TraceRetentionRuleMaxDays",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v6/*: any*/)
                        ],
                        "type": "TraceRetentionRuleMaxCount",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v5/*: any*/),
                          (v6/*: any*/)
                        ],
                        "type": "TraceRetentionRuleMaxDaysOrCount",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "49b369ab7ad84cf211bbecaf35401515",
    "id": null,
    "metadata": {},
    "name": "ProjectConfigPageProjectRetentionPolicyCardQuery",
    "operationKind": "query",
    "text": "query ProjectConfigPageProjectRetentionPolicyCardQuery(\n  $id: GlobalID!\n) {\n  node(id: $id) {\n    __typename\n    ...ProjectConfigPage_projectRetentionPolicyCard\n    __isNode: __typename\n    id\n  }\n}\n\nfragment ProjectConfigPage_projectRetentionPolicyCard on Project {\n  id\n  name\n  traceRetentionPolicy {\n    id\n    name\n    cronExpression\n    rule {\n      __typename\n      ... on TraceRetentionRuleMaxDays {\n        maxDays\n      }\n      ... on TraceRetentionRuleMaxCount {\n        maxCount\n      }\n      ... on TraceRetentionRuleMaxDaysOrCount {\n        maxDays\n        maxCount\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "be41839ade0a17a6d549249abad5d6ab";

export default node;
