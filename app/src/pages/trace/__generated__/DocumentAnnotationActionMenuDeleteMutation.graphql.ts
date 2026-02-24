/**
 * @generated SignedSource<<391305d3892dab4c34541ed549d8f88c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type DeleteAnnotationsInput = {
  annotationIds: ReadonlyArray<string>;
};
export type DocumentAnnotationActionMenuDeleteMutation$variables = {
  input: DeleteAnnotationsInput;
  spanId: string;
};
export type DocumentAnnotationActionMenuDeleteMutation$data = {
  readonly deleteDocumentAnnotations: {
    readonly query: {
      readonly node: {
        readonly documentEvaluations?: ReadonlyArray<{
          readonly annotatorKind: AnnotatorKind;
          readonly documentPosition: number;
          readonly explanation: string | null;
          readonly id: string;
          readonly label: string | null;
          readonly name: string;
          readonly score: number | null;
        }>;
      };
    };
  };
};
export type DocumentAnnotationActionMenuDeleteMutation = {
  response: DocumentAnnotationActionMenuDeleteMutation$data;
  variables: DocumentAnnotationActionMenuDeleteMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
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
    {
      "alias": null,
      "args": null,
      "concreteType": "DocumentAnnotation",
      "kind": "LinkedField",
      "name": "documentEvaluations",
      "plural": true,
      "selections": [
        (v3/*: any*/),
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
          "name": "documentPosition",
          "storageKey": null
        },
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DocumentAnnotationActionMenuDeleteMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DocumentAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "deleteDocumentAnnotations",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v2/*: any*/),
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
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DocumentAnnotationActionMenuDeleteMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DocumentAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "deleteDocumentAnnotations",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v2/*: any*/),
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
                  (v3/*: any*/)
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
    "cacheID": "d6a43f135232b4d39a78f4cf5887009d",
    "id": null,
    "metadata": {},
    "name": "DocumentAnnotationActionMenuDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation DocumentAnnotationActionMenuDeleteMutation(\n  $input: DeleteAnnotationsInput!\n  $spanId: ID!\n) {\n  deleteDocumentAnnotations(input: $input) {\n    query {\n      node(id: $spanId) {\n        __typename\n        ... on Span {\n          documentEvaluations {\n            id\n            annotatorKind\n            documentPosition\n            name\n            label\n            score\n            explanation\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4ffc8c0128130b08edd7a62d0ac535ef";

export default node;
