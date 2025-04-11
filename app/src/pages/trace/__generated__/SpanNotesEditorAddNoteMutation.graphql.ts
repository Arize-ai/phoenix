/**
 * @generated SignedSource<<9d3e963fe84d7750690487a7a3fcd33c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "HUMAN" | "LLM";
export type CreateSpanAnnotationInput = {
  annotatorKind: AnnotatorKind;
  explanation?: string | null;
  identifier?: string | null;
  label?: string | null;
  metadata?: any;
  name: string;
  score?: number | null;
  source: AnnotationSource;
  spanId: string;
};
export type SpanNotesEditorAddNoteMutation$variables = {
  input: CreateSpanAnnotationInput;
};
export type SpanNotesEditorAddNoteMutation$data = {
  readonly createSpanAnnotations: {
    readonly __typename: "SpanAnnotationMutationPayload";
  };
};
export type SpanNotesEditorAddNoteMutation = {
  response: SpanNotesEditorAddNoteMutation$data;
  variables: SpanNotesEditorAddNoteMutation$variables;
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
        "kind": "ScalarField",
        "name": "__typename",
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
    "name": "SpanNotesEditorAddNoteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SpanNotesEditorAddNoteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "4b60158f2ea6a5f2986bb391c364037a",
    "id": null,
    "metadata": {},
    "name": "SpanNotesEditorAddNoteMutation",
    "operationKind": "mutation",
    "text": "mutation SpanNotesEditorAddNoteMutation(\n  $input: CreateSpanAnnotationInput!\n) {\n  createSpanAnnotations(input: [$input]) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "9dbd60f36b7c25e2b9044ac037c347c8";

export default node;
