/**
 * @generated SignedSource<<990f452d161182cc78b52eb8faaa7190>>
 * @lightSyntaxTransform
 * @nogrep
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
    readonly repetitions?: ReadonlyArray<{
      readonly annotations: {
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
      readonly endTime: string;
      readonly error: string | null;
      readonly example: {
        readonly id: string;
        readonly revision: {
          readonly input: any;
          readonly output: any;
        };
      };
      readonly output: any | null;
      readonly startTime: string;
    }>;
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
  "name": "startTime",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetExample",
  "kind": "LinkedField",
  "name": "example",
  "plural": false,
  "selections": [
    (v6/*: any*/),
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
        (v2/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v8 = {
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
            (v6/*: any*/),
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "selections": [
      {
        "alias": "run",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRepetition",
                "kind": "LinkedField",
                "name": "repetitions",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "ExperimentRun",
            "abstractKey": null
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "selections": [
      {
        "alias": "run",
        "args": (v1/*: any*/),
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
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRepetition",
                "kind": "LinkedField",
                "name": "repetitions",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v6/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "ExperimentRun",
            "abstractKey": null
          },
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8da67e18ccaa111db2abf0d875e9e793",
    "id": null,
    "metadata": {},
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "operationKind": "query",
    "text": "query PlaygroundExperimentRunDetailsDialogQuery(\n  $runId: ID!\n) {\n  run: node(id: $runId) {\n    __typename\n    ... on ExperimentRun {\n      repetitions {\n        output\n        startTime\n        endTime\n        error\n        example {\n          id\n          revision {\n            input\n            output\n          }\n        }\n        annotations {\n          edges {\n            annotation: node {\n              id\n              name\n              label\n              score\n              explanation\n              annotatorKind\n            }\n          }\n        }\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5c7e0a82698f4194d7eec068949b3df2";

export default node;
