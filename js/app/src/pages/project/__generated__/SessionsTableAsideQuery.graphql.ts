/**
 * @generated SignedSource<<13125d116f5ad2d849cbf81e6e9106f8>>
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
export type SessionsTableAsideQuery$variables = {
  id: string;
  sessionFilterCondition?: string | null;
  timeRange: TimeRange;
};
export type SessionsTableAsideQuery$data = {
  readonly project: {
    readonly averageSessionDurationMs?: number | null;
    readonly averageTracesPerSession?: number | null;
    readonly description?: string | null;
    readonly name?: string;
    readonly sessionAnnotationNames?: ReadonlyArray<string>;
    readonly sessionCount?: number;
    readonly sessionDurationMsP50?: number | null;
    readonly sessionDurationMsP99?: number | null;
  };
};
export type SessionsTableAsideQuery = {
  response: SessionsTableAsideQuery$data;
  variables: SessionsTableAsideQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
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
    "variableName": "id"
  }
],
v4 = {
  "kind": "Variable",
  "name": "sessionFilterCondition",
  "variableName": "sessionFilterCondition"
},
v5 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v6 = [
  (v4/*:: as any*/),
  (v5/*:: as any*/)
],
v7 = {
  "kind": "InlineFragment",
  "selections": [
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
      "kind": "ScalarField",
      "name": "description",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v6/*:: as any*/),
      "kind": "ScalarField",
      "name": "sessionCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v6/*:: as any*/),
      "kind": "ScalarField",
      "name": "averageSessionDurationMs",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v6/*:: as any*/),
      "kind": "ScalarField",
      "name": "averageTracesPerSession",
      "storageKey": null
    },
    {
      "alias": "sessionDurationMsP50",
      "args": [
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.5
        },
        (v4/*:: as any*/),
        (v5/*:: as any*/)
      ],
      "kind": "ScalarField",
      "name": "sessionDurationMsQuantile",
      "storageKey": null
    },
    {
      "alias": "sessionDurationMsP99",
      "args": [
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.99
        },
        (v4/*:: as any*/),
        (v5/*:: as any*/)
      ],
      "kind": "ScalarField",
      "name": "sessionDurationMsQuantile",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "sessionAnnotationNames",
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
    "name": "SessionsTableAsideQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*:: as any*/)
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
    "name": "SessionsTableAsideQuery",
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
          (v7/*:: as any*/),
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
    "cacheID": "a18bc16f174b9628bada44104061bee2",
    "id": null,
    "metadata": {},
    "name": "SessionsTableAsideQuery",
    "operationKind": "query",
    "text": "query SessionsTableAsideQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n  $sessionFilterCondition: String\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      name\n      description\n      sessionCount(timeRange: $timeRange, sessionFilterCondition: $sessionFilterCondition)\n      averageSessionDurationMs(timeRange: $timeRange, sessionFilterCondition: $sessionFilterCondition)\n      averageTracesPerSession(timeRange: $timeRange, sessionFilterCondition: $sessionFilterCondition)\n      sessionDurationMsP50: sessionDurationMsQuantile(probability: 0.5, timeRange: $timeRange, sessionFilterCondition: $sessionFilterCondition)\n      sessionDurationMsP99: sessionDurationMsQuantile(probability: 0.99, timeRange: $timeRange, sessionFilterCondition: $sessionFilterCondition)\n      sessionAnnotationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "649fd07e8ad63157bcd32750108c807b";

export default node;
