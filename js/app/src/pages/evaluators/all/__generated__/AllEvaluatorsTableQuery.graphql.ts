/**
 * @generated SignedSource<<e8b782f7a3af675808ad36eda9665334>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "DECISION" | "LLM";
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "HEALTHY" | "NEVER_RUN" | "STARTING";
export type AllEvaluatorsTableQuery$variables = {
  first: number;
};
export type AllEvaluatorsTableQuery$data = {
  readonly datasetEvaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly createdAt: string;
        readonly dataset: {
          readonly id: string;
          readonly name: string;
        };
        readonly evaluator: {
          readonly kind: EvaluatorKind;
        };
        readonly id: string;
        readonly name: string;
        readonly updatedAt: string;
      };
    }>;
  };
  readonly projectEvaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly createdAt: string;
        readonly evaluator: {
          readonly kind: EvaluatorKind;
        };
        readonly id: string;
        readonly name: string;
        readonly project: {
          readonly id: string;
          readonly name: string;
        };
        readonly runSummary: {
          readonly clearedCount: number;
          readonly evaluatedCount: number;
          readonly failedCount: number;
          readonly lastRunAt: string | null;
          readonly oldestWaitingOrRetryingAt: string | null;
          readonly queuedCount: number;
          readonly status: ProjectEvaluatorRunStatus;
        };
        readonly updatedAt: string;
      };
    }>;
  };
};
export type AllEvaluatorsTableQuery = {
  response: AllEvaluatorsTableQuery$data;
  variables: AllEvaluatorsTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "first"
  }
],
v1 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v2 = [
  (v1/*:: as any*/)
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
  "name": "createdAt",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v7 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/)
],
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": (v7/*:: as any*/),
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "evaluator",
  "plural": false,
  "selections": [
    (v9/*:: as any*/)
  ],
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "ProjectEvaluatorRunSummary",
  "kind": "LinkedField",
  "name": "runSummary",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "status",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastRunAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "queuedCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluatedCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "failedCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "clearedCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "oldestWaitingOrRetryingAt",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v12 = [
  (v1/*:: as any*/),
  {
    "kind": "Literal",
    "name": "sort",
    "value": {
      "col": "createdAt",
      "dir": "desc"
    }
  }
],
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "Dataset",
  "kind": "LinkedField",
  "name": "dataset",
  "plural": false,
  "selections": (v7/*:: as any*/),
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "evaluator",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "__typename",
      "storageKey": null
    },
    (v9/*:: as any*/),
    (v3/*:: as any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "AllEvaluatorsTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "ProjectEvaluatorConnection",
        "kind": "LinkedField",
        "name": "projectEvaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectEvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ProjectEvaluator",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v8/*:: as any*/),
                  (v10/*:: as any*/),
                  (v11/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v12/*:: as any*/),
        "concreteType": "DatasetEvaluatorConnection",
        "kind": "LinkedField",
        "name": "datasetEvaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetEvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v13/*:: as any*/),
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
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "AllEvaluatorsTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "ProjectEvaluatorConnection",
        "kind": "LinkedField",
        "name": "projectEvaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectEvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ProjectEvaluator",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v8/*:: as any*/),
                  (v14/*:: as any*/),
                  (v11/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v12/*:: as any*/),
        "concreteType": "DatasetEvaluatorConnection",
        "kind": "LinkedField",
        "name": "datasetEvaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetEvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v13/*:: as any*/),
                  (v14/*:: as any*/)
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
    "cacheID": "251bb0b3b5dc2ded324e6139918e6eca",
    "id": null,
    "metadata": {},
    "name": "AllEvaluatorsTableQuery",
    "operationKind": "query",
    "text": "query AllEvaluatorsTableQuery(\n  $first: Int!\n) {\n  projectEvaluators(first: $first) {\n    edges {\n      node {\n        id\n        name\n        createdAt\n        updatedAt\n        project {\n          id\n          name\n        }\n        evaluator {\n          __typename\n          kind\n          id\n        }\n        runSummary {\n          status\n          lastRunAt\n          queuedCount\n          evaluatedCount\n          failedCount\n          clearedCount\n          oldestWaitingOrRetryingAt\n        }\n      }\n    }\n  }\n  datasetEvaluators(first: $first, sort: {col: createdAt, dir: desc}) {\n    edges {\n      node {\n        id\n        name\n        createdAt\n        updatedAt\n        dataset {\n          id\n          name\n        }\n        evaluator {\n          __typename\n          kind\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c2c7c8ea598627fdc969700351cc412e";

export default node;
