/**
 * @generated SignedSource<<6354870f0e1ece6b8a209d52cabc5426>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
export type DatasetEvaluatorsPageQuery$variables = {
  datasetId: string;
};
export type DatasetEvaluatorsPageQuery$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly isAssignedToDataset: boolean;
        readonly kind: EvaluatorKind;
        readonly name: string;
      };
    }>;
  };
};
export type DatasetEvaluatorsPageQuery = {
  response: DatasetEvaluatorsPageQuery$data;
  variables: DatasetEvaluatorsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  }
],
v1 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
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
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "datasetId",
      "variableName": "datasetId"
    }
  ],
  "kind": "ScalarField",
  "name": "isAssignedToDataset",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetEvaluatorsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "EvaluatorConnection",
        "kind": "LinkedField",
        "name": "evaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "EvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "evaluators(first:100)"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DatasetEvaluatorsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "EvaluatorConnection",
        "kind": "LinkedField",
        "name": "evaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "EvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
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
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "evaluators(first:100)"
      }
    ]
  },
  "params": {
    "cacheID": "1b0262493d5ed2b83c3a7ae694a8da10",
    "id": null,
    "metadata": {},
    "name": "DatasetEvaluatorsPageQuery",
    "operationKind": "query",
    "text": "query DatasetEvaluatorsPageQuery(\n  $datasetId: ID!\n) {\n  evaluators(first: 100) {\n    edges {\n      node {\n        __typename\n        id\n        name\n        kind\n        isAssignedToDataset(datasetId: $datasetId)\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d062432e1857cf96a47abb5b6eec7be2";

export default node;
