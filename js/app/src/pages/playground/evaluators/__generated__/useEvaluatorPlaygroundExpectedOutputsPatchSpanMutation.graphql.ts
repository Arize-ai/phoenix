/**
 * @generated SignedSource<<f9784e778eb4709d5e58c319897f37f5>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type PatchAnnotationInput = {
  annotationId: string;
  annotatorKind?: AnnotatorKind | null;
  explanation?: string | null;
  identifier?: string | null;
  label?: string | null;
  metadata?: any | null;
  name?: string | null;
  score?: number | null;
  source?: AnnotationSource | null;
};
export type useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation$variables = {
  input: ReadonlyArray<PatchAnnotationInput>;
};
export type useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation$data = {
  readonly patchSpanAnnotations: {
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
export type useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation = {
  response: useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation$data;
  variables: useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation$variables;
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
    "name": "patchSpanAnnotations",
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
    "name": "useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "c6e8c7d4ae4d656bab24bd3ef38efc0b",
    "id": null,
    "metadata": {},
    "name": "useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation",
    "operationKind": "mutation",
    "text": "mutation useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation(\n  $input: [PatchAnnotationInput!]!\n) {\n  patchSpanAnnotations(input: $input) {\n    spanAnnotations {\n      id\n      spanId\n      name\n      label\n      score\n      explanation\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6e1946b392ea3e116ed80def0dbb7f34";

export default node;
