/**
 * @generated SignedSource<<bb02554f50c42217dcccba1a213a0453>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectEvaluatorScopePanelSessionCountQuery$variables = {
  projectId: string;
  sessionFilterCondition?: string | null;
  timeRange: TimeRange;
};
export type ProjectEvaluatorScopePanelSessionCountQuery$data = {
  readonly project: {
    readonly sessionCount?: number;
  };
};
export type ProjectEvaluatorScopePanelSessionCountQuery = {
  response: ProjectEvaluatorScopePanelSessionCountQuery$data;
  variables: ProjectEvaluatorScopePanelSessionCountQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sessionFilterCondition"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "sessionFilterCondition",
          "variableName": "sessionFilterCondition"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "kind": "ScalarField",
      "name": "sessionCount",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorScopePanelSessionCountQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v2/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorScopePanelSessionCountQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
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
          (v4/*:: as any*/),
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
    ]
  },
  "params": {
    "cacheID": "0f883731aef898932f41642f94ab1b98",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorScopePanelSessionCountQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorScopePanelSessionCountQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n  $sessionFilterCondition: String\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      sessionCount(timeRange: $timeRange, sessionFilterCondition: $sessionFilterCondition)\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "1999d47a6289158fc5d94ef12348cdc8";

export default node;
