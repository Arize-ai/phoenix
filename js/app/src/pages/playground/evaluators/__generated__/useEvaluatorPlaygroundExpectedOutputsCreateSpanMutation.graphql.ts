/**
 * @generated SignedSource<<fb37875a01b12c083a5967b7fdeb90b9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type CreateSpanAnnotationInput = {
  annotatorKind: AnnotatorKind;
  explanation?: string | null;
  identifier?: string | null;
  label?: string | null;
  metadata: any;
  name: string;
  score?: number | null;
  source: AnnotationSource;
  spanId: string;
};
export type useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation$variables = {
  input: ReadonlyArray<CreateSpanAnnotationInput>;
};
export type useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation$data = {
  readonly createSpanAnnotations: {
    readonly spanAnnotations: ReadonlyArray<{
      readonly explanation: string | null;
      readonly id: string;
      readonly label: string | null;
      readonly name: string;
      readonly score: number | null;
      readonly spanId: string;
    }>;
  };
};
export type useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation = {
  response: useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation$data;
  variables: useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "SpanAnnotationMutationPayload",
    "kind": "LinkedField",
    "name": "createSpanAnnotations",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SpanAnnotation",
        "kind": "LinkedField",
        "name": "spanAnnotations",
        "plural": true,
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
            "kind": "ScalarField",
            "name": "spanId",
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
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "9f0f27c682be2f463de117971bbc9655",
    "id": null,
    "metadata": {},
    "name": "useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation",
    "operationKind": "mutation",
    "text": "mutation useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation(\n  $input: [CreateSpanAnnotationInput!]!\n) {\n  createSpanAnnotations(input: $input) {\n    spanAnnotations {\n      id\n      spanId\n      name\n      label\n      score\n      explanation\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "81ce695b50bf10fa8b6f662ed93196e1";

export default node;
