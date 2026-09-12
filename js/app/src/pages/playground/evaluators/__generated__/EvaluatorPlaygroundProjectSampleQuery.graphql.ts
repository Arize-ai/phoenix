/**
 * @generated SignedSource<<bcca8c5003354fb518c3d5c577a3b2ec>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type EvaluatorPlaygroundProjectSampleQuery$variables = {
  filterCondition?: string | null;
  first: number;
  projectId: string;
  start: string;
};
export type EvaluatorPlaygroundProjectSampleQuery$data = {
  readonly node: {
    readonly spans?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly evaluationContext: any;
          readonly id: string;
          readonly name: string;
          readonly spanAnnotations: ReadonlyArray<{
            readonly annotatorKind: AnnotatorKind;
            readonly explanation: string | null;
            readonly id: string;
            readonly label: string | null;
            readonly name: string;
            readonly score: number | null;
          }>;
        };
      }>;
    };
  };
};
export type EvaluatorPlaygroundProjectSampleQuery = {
  response: EvaluatorPlaygroundProjectSampleQuery$data;
  variables: EvaluatorPlaygroundProjectSampleQuery$variables;
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
  "name": "first"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "start"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
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
          "name": "first",
          "variableName": "first"
        },
        {
          "kind": "Literal",
          "name": "sort",
          "value": {
            "col": "startTime",
            "dir": "desc"
          }
        },
        {
          "fields": [
            {
              "kind": "Variable",
              "name": "start",
              "variableName": "start"
            }
          ],
          "kind": "ObjectValue",
          "name": "timeRange"
        }
      ],
      "concreteType": "SpanConnection",
      "kind": "LinkedField",
      "name": "spans",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "Span",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v5/*:: as any*/),
                (v6/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "evaluationContext",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "SpanAnnotation",
                  "kind": "LinkedField",
                  "name": "spanAnnotations",
                  "plural": true,
                  "selections": [
                    (v5/*:: as any*/),
                    (v6/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "annotatorKind",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "label",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "score",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "explanation",
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
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorPlaygroundProjectSampleQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*:: as any*/),
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
      (v2/*:: as any*/),
      (v1/*:: as any*/),
      (v0/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EvaluatorPlaygroundProjectSampleQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*:: as any*/),
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
          (v5/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "9118608435c74c2a94b441176b3fd77a",
    "id": null,
    "metadata": {},
    "name": "EvaluatorPlaygroundProjectSampleQuery",
    "operationKind": "query",
    "text": "query EvaluatorPlaygroundProjectSampleQuery(\n  $projectId: ID!\n  $first: Int!\n  $filterCondition: String\n  $start: DateTime!\n) {\n  node(id: $projectId) {\n    __typename\n    ... on Project {\n      spans(first: $first, sort: {col: startTime, dir: desc}, filterCondition: $filterCondition, timeRange: {start: $start}) {\n        edges {\n          node {\n            id\n            name\n            evaluationContext\n            spanAnnotations {\n              id\n              name\n              annotatorKind\n              label\n              score\n              explanation\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "788a8d2de1620d177cc910dd9d76777a";

export default node;
