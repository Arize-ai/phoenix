/**
 * @generated SignedSource<<0ca568b7668d28faa5d4b14509858522>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateSpanNoteInput = {
  note: string;
  spanId: string;
};
export type SpanNotesEditorAddNoteMutation$variables = {
  input: CreateSpanNoteInput;
};
export type SpanNotesEditorAddNoteMutation$data = {
  readonly createSpanNote: {
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
        "kind": "Variable",
        "name": "annotationInput",
        "variableName": "input"
      }
    ],
    "concreteType": "SpanAnnotationMutationPayload",
    "kind": "LinkedField",
    "name": "createSpanNote",
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
    "cacheID": "855aa00f68b36e86f375e7765413ac81",
    "id": null,
    "metadata": {},
    "name": "SpanNotesEditorAddNoteMutation",
    "operationKind": "mutation",
    "text": "mutation SpanNotesEditorAddNoteMutation(\n  $input: CreateSpanNoteInput!\n) {\n  createSpanNote(annotationInput: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "fc7452182db44527c3f68ba81dd53e58";

export default node;
