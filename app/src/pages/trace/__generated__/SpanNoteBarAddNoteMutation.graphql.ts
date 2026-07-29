/**
 * @generated SignedSource<<c61c048dceb36145897dc0e19862d567>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateSpanNoteInput = {
  note: string;
  spanId: string;
};
export type SpanNoteBarAddNoteMutation$variables = {
  input: CreateSpanNoteInput;
};
export type SpanNoteBarAddNoteMutation$data = {
  readonly createSpanNote: {
    readonly __typename: "SpanAnnotationMutationPayload";
  };
};
export type SpanNoteBarAddNoteMutation = {
  response: SpanNoteBarAddNoteMutation$data;
  variables: SpanNoteBarAddNoteMutation$variables;
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanNoteBarAddNoteMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SpanNoteBarAddNoteMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "490b67e3e6b1128754926667b835a759",
    "id": null,
    "metadata": {},
    "name": "SpanNoteBarAddNoteMutation",
    "operationKind": "mutation",
    "text": "mutation SpanNoteBarAddNoteMutation(\n  $input: CreateSpanNoteInput!\n) {\n  createSpanNote(annotationInput: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "bdecce115160d024f0cfcbd181ae315e";

export default node;
