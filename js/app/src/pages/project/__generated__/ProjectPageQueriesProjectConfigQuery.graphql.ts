/**
 * @generated SignedSource<<737a4f7159a6ab8ed7ea25afe35af12c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageQueriesProjectConfigQuery$variables = {
  id: string;
};
export type ProjectPageQueriesProjectConfigQuery$data = {
  readonly project: {
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_projectConfigCard" | "ProjectRetentionPolicyCard_policy">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"ProjectRetentionPolicyCard_query">;
};
export type ProjectPageQueriesProjectConfigQuery = {
  response: ProjectPageQueriesProjectConfigQuery$data;
  variables: ProjectPageQueriesProjectConfigQuery$variables;
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
  "name": "__typename",
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
  "name": "maxDays",
  "storageKey": null
},
v7 = {
  "kind": "InlineFragment",
  "selections": [
    (v6/*:: as any*/)
  ],
  "type": "TraceRetentionRuleMaxDays",
  "abstractKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
  "storageKey": null
},
v9 = {
  "kind": "InlineFragment",
  "selections": [
    (v8/*:: as any*/)
  ],
  "type": "TraceRetentionRuleMaxCount",
  "abstractKey": null
},
v10 = {
  "kind": "InlineFragment",
  "selections": [
    (v6/*:: as any*/),
    (v8/*:: as any*/)
  ],
  "type": "TraceRetentionRuleMaxDaysOrCount",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageQueriesProjectConfigQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "ProjectConfigPage_projectConfigCard"
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "ProjectRetentionPolicyCard_policy"
          }
        ],
        "storageKey": null
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ProjectRetentionPolicyCard_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProjectPageQueriesProjectConfigQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "description",
                "storageKey": null
              },
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
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ProjectTraceRetentionPolicy",
                "kind": "LinkedField",
                "name": "traceRetentionPolicy",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "rule",
                    "plural": false,
                    "selections": [
                      (v3/*:: as any*/),
                      (v7/*:: as any*/),
                      (v9/*:: as any*/),
                      (v10/*:: as any*/)
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
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ProjectTraceRetentionPolicyConnection",
        "kind": "LinkedField",
        "name": "projectTraceRetentionPolicies",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectTraceRetentionPolicyEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ProjectTraceRetentionPolicy",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "rule",
                    "plural": false,
                    "selections": [
                      (v3/*:: as any*/),
                      (v9/*:: as any*/),
                      (v7/*:: as any*/),
                      (v10/*:: as any*/)
                    ],
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
      }
    ]
  },
  "params": {
    "cacheID": "c34e92fc34da4110c22dee4c5669219a",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQueriesProjectConfigQuery",
    "operationKind": "query",
    "text": "query ProjectPageQueriesProjectConfigQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    id\n    ...ProjectConfigPage_projectConfigCard\n    ...ProjectRetentionPolicyCard_policy\n  }\n  ...ProjectRetentionPolicyCard_query\n}\n\nfragment ProjectConfigPage_projectConfigCard on Project {\n  id\n  name\n  description\n  gradientStartColor\n  gradientEndColor\n}\n\nfragment ProjectRetentionPolicyCard_policy on Project {\n  id\n  name\n  traceRetentionPolicy {\n    id\n    name\n    cronExpression\n    rule {\n      __typename\n      ... on TraceRetentionRuleMaxDays {\n        maxDays\n      }\n      ... on TraceRetentionRuleMaxCount {\n        maxCount\n      }\n      ... on TraceRetentionRuleMaxDaysOrCount {\n        maxDays\n        maxCount\n      }\n    }\n  }\n}\n\nfragment ProjectRetentionPolicyCard_query on Query {\n  ...ProjectTraceRetentionPolicySelectFragment\n}\n\nfragment ProjectTraceRetentionPolicySelectFragment on Query {\n  projectTraceRetentionPolicies {\n    edges {\n      node {\n        id\n        name\n        cronExpression\n        rule {\n          __typename\n          ... on TraceRetentionRuleMaxCount {\n            maxCount\n          }\n          ... on TraceRetentionRuleMaxDays {\n            maxDays\n          }\n          ... on TraceRetentionRuleMaxDaysOrCount {\n            maxDays\n            maxCount\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3d4a317421ae07c5ad4ddd7f22b99771";

export default node;
