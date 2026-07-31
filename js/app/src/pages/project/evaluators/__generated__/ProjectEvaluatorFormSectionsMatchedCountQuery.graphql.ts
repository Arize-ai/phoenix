/**
 * @generated SignedSource<<aa4980c673a39bc8c8a9a7f27ffa105e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectEvaluatorFormSectionsMatchedCountQuery$variables = {
  filterCondition?: string | null;
  projectId: string;
  timeRange: TimeRange;
};
export type ProjectEvaluatorFormSectionsMatchedCountQuery$data = {
  readonly project: {
    readonly spanCountTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly totalCount: number | null;
      }>;
    };
  };
};
export type ProjectEvaluatorFormSectionsMatchedCountQuery = {
  response: ProjectEvaluatorFormSectionsMatchedCountQuery$data;
  variables: ProjectEvaluatorFormSectionsMatchedCountQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterCondition"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
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
          "name": "filterCondition",
          "variableName": "filterCondition"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "SpanCountTimeSeries",
      "kind": "LinkedField",
      "name": "spanCountTimeSeries",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanCountTimeSeriesDataPoint",
          "kind": "LinkedField",
          "name": "data",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "totalCount",
              "storageKey": null
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
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorFormSectionsMatchedCountQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/)
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
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorFormSectionsMatchedCountQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*: any*/),
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
          (v4/*: any*/),
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
    "cacheID": "29e940b3adbe4f92f0f38b798cc5095a",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorFormSectionsMatchedCountQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorFormSectionsMatchedCountQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n  $filterCondition: String\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      spanCountTimeSeries(timeRange: $timeRange, filterCondition: $filterCondition) {\n        data {\n          totalCount\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "2fcfa15424ee10be4cc10c70f0538539";

export default node;
