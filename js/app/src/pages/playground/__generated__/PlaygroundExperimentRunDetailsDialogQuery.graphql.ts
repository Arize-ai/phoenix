/**
 * @generated SignedSource<<66ab661745b4a31fa36ae5c8657390d6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentRunAnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type PlaygroundExperimentRunDetailsDialogQuery$variables = {
  runId: string;
};
export type PlaygroundExperimentRunDetailsDialogQuery$data = {
  readonly run: {
    readonly annotations?: {
      readonly edges: ReadonlyArray<{
        readonly annotation: {
          readonly annotatorKind: ExperimentRunAnnotatorKind;
          readonly explanation: string | null;
          readonly id: string;
          readonly label: string | null;
          readonly name: string;
          readonly score: number | null;
        };
      }>;
    };
    readonly endTime?: string;
    readonly error?: string | null;
    readonly example?: {
      readonly id: string;
      readonly revision: {
        readonly input: any;
        readonly output: any;
      };
    };
    readonly output?: any | null;
    readonly startTime?: string;
  };
};
export type PlaygroundExperimentRunDetailsDialogQuery = {
  response: PlaygroundExperimentRunDetailsDialogQuery$data;
  variables: PlaygroundExperimentRunDetailsDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "runId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "runId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
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
  "kind": "InlineFragment",
  "selections": [
    (v2/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "startTime",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "endTime",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "error",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetExample",
      "kind": "LinkedField",
      "name": "example",
      "plural": false,
      "selections": [
        (v3/*:: as any*/),
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
            (v2/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "ExperimentRunAnnotationConnection",
      "kind": "LinkedField",
      "name": "annotations",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ExperimentRunAnnotationEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "annotation",
              "args": null,
              "concreteType": "ExperimentRunAnnotation",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v3/*:: as any*/),
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
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "annotatorKind",
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
  "type": "ExperimentRun",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "selections": [
      {
        "alias": "run",
        "args": (v1/*:: as any*/),
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "selections": [
      {
        "alias": "run",
        "args": (v1/*:: as any*/),
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
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a0e03785a6ab482250d20af95ca7ef91",
    "id": null,
    "metadata": {},
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "operationKind": "query",
    "text": "query PlaygroundExperimentRunDetailsDialogQuery(\n  $runId: ID!\n) {\n  run: node(id: $runId) {\n    __typename\n    ... on ExperimentRun {\n      output\n      startTime\n      endTime\n      error\n      example {\n        id\n        revision {\n          input\n          output\n        }\n      }\n      annotations {\n        edges {\n          annotation: node {\n            id\n            name\n            label\n            score\n            explanation\n            annotatorKind\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e2203e071e6fce91c764fa6fee48dfc1";

export default node;
