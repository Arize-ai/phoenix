/**
 * @generated SignedSource<<0a2be2d00b3562109d96f972b47d283f>>
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
export type ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation$variables = {
  input: PatchAnnotationInput;
};
export type ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation$data = {
  readonly patchSpanAnnotations: {
    readonly spanAnnotations: ReadonlyArray<{
      readonly id: string;
    }>;
  };
};
export type ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation = {
  response: ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation$data;
  variables: ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation$variables;
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
    "name": "ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "bdd487081be06b4f1da12fc64162278f",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation(\n  $input: PatchAnnotationInput!\n) {\n  patchSpanAnnotations(input: [$input]) {\n    spanAnnotations {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "fd9c7fd8b06129306d6ec24c5df6794b";

export default node;
