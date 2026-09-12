/**
 * @generated SignedSource<<22c978a5f43262f6dc2a13a53d43f843>>
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
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
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
                (v4/*:: as any*/),
                (v5/*:: as any*/),
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
                    (v4/*:: as any*/),
                    (v5/*:: as any*/),
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
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorPlaygroundProjectSampleQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*:: as any*/)
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
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EvaluatorPlaygroundProjectSampleQuery",
    "selections": [
      {
        "alias": null,
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
          (v6/*:: as any*/),
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8c97e571e2506228d8c86a055219de51",
    "id": null,
    "metadata": {},
    "name": "EvaluatorPlaygroundProjectSampleQuery",
    "operationKind": "query",
    "text": "query EvaluatorPlaygroundProjectSampleQuery(\n  $projectId: ID!\n  $first: Int!\n  $filterCondition: String\n) {\n  node(id: $projectId) {\n    __typename\n    ... on Project {\n      spans(first: $first, sort: {col: startTime, dir: desc}, filterCondition: $filterCondition) {\n        edges {\n          node {\n            id\n            name\n            evaluationContext\n            spanAnnotations {\n              id\n              name\n              annotatorKind\n              label\n              score\n              explanation\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "31ff12650e969a211f766a1bada6dc74";

export default node;
