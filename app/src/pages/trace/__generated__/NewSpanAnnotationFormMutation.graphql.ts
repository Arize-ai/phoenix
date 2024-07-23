/**
 * @generated SignedSource<<79ed54366bce1fa7c735125598139cc8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type AnnotatorKind = "HUMAN" | "LLM";
export type CreateSpanAnnotationInput = {
  annotatorKind: AnnotatorKind;
  explanation?: string | null;
  label?: string | null;
  metadata?: any;
  name: string;
  score?: number | null;
  spanId: string;
};
export type NewSpanAnnotationFormMutation$variables = {
  input: CreateSpanAnnotationInput;
};
export type NewSpanAnnotationFormMutation$data = {
  readonly createSpanAnnotations: {
    readonly spanAnnotations: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type NewSpanAnnotationFormMutation = {
  response: NewSpanAnnotationFormMutation$data;
  variables: NewSpanAnnotationFormMutation$variables;
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
        "items": [
          {
            "kind": "Variable",
            "name": "input.0",
            "variableName": "input"
          }
        ],
        "kind": "ListValue",
        "name": "input"
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
            "name": "name",
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
    "name": "NewSpanAnnotationFormMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewSpanAnnotationFormMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "0a925286639f9e4c3e0d8dd9a7fbb359",
    "id": null,
    "metadata": {},
    "name": "NewSpanAnnotationFormMutation",
    "operationKind": "mutation",
    "text": "mutation NewSpanAnnotationFormMutation(\n  $input: CreateSpanAnnotationInput!\n) {\n  createSpanAnnotations(input: [$input]) {\n    spanAnnotations {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f15659fb1f6af1293742a5fa1edf52e5";

export default node;
