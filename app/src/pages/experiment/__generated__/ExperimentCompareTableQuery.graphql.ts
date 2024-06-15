/**
 * @generated SignedSource<<8962cd02e54b36b9a2805329ec09932e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type ExperimentCompareTableQuery$variables = {
  baselineExperimentId: string;
  experimentIds: ReadonlyArray<string>;
};
export type ExperimentCompareTableQuery$data = {
  readonly comparisons: ReadonlyArray<{
    readonly example: {
      readonly id: string;
      readonly revision: {
        readonly expectedOutput: any;
        readonly input: any;
      };
    };
    readonly runComparisonItems: ReadonlyArray<{
      readonly experimentId: string;
      readonly runs: ReadonlyArray<{
        readonly error: string | null;
        readonly output: any | null;
      }>;
    }>;
  }>;
};
export type ExperimentCompareTableQuery = {
  response: ExperimentCompareTableQuery$data;
  variables: ExperimentCompareTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "baselineExperimentId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentIds"
  }
],
v1 = [
  {
    "alias": "comparisons",
    "args": [
      {
        "kind": "Variable",
        "name": "baselineExperimentId",
        "variableName": "baselineExperimentId"
      },
      {
        "kind": "Variable",
        "name": "comparisonExperimentIds",
        "variableName": "experimentIds"
      }
    ],
    "concreteType": "ExperimentComparison",
    "kind": "LinkedField",
    "name": "compareExperiments",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetExample",
        "kind": "LinkedField",
        "name": "example",
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
            "concreteType": "DatasetExampleRevision",
            "kind": "LinkedField",
            "name": "revision",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "input",
                "storageKey": null
              },
              {
                "alias": "expectedOutput",
                "args": null,
                "kind": "ScalarField",
                "name": "output",
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
        "args": null,
        "concreteType": "RunComparisonItem",
        "kind": "LinkedField",
        "name": "runComparisonItems",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "experimentId",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "ExperimentRun",
            "kind": "LinkedField",
            "name": "runs",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "output",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "error",
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentCompareTableQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExperimentCompareTableQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "61af1f01744c88ba91c49f320386ef46",
    "id": null,
    "metadata": {},
    "name": "ExperimentCompareTableQuery",
    "operationKind": "query",
    "text": "query ExperimentCompareTableQuery(\n  $baselineExperimentId: GlobalID!\n  $experimentIds: [GlobalID!]!\n) {\n  comparisons: compareExperiments(baselineExperimentId: $baselineExperimentId, comparisonExperimentIds: $experimentIds) {\n    example {\n      id\n      revision {\n        input\n        expectedOutput: output\n      }\n    }\n    runComparisonItems {\n      experimentId\n      runs {\n        output\n        error\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "183d7e35dd715fb1e2a6eb2fe6f82c00";

export default node;
