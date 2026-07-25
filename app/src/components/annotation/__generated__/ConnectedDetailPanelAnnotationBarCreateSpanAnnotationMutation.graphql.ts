/**
 * @generated SignedSource<<29c266328dd68d3b5a11857ab77a1943>>
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
export type ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation$variables = {
  input: CreateSpanAnnotationInput;
};
export type ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation$data = {
  readonly createSpanAnnotations: {
    readonly spanAnnotations: ReadonlyArray<{
      readonly id: string;
    }>;
  };
};
export type ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation = {
  response: ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation$data;
  variables: ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation$variables;
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
    "name": "ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "978f0eacf064a6b2c5559b110eecf398",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation(\n  $input: CreateSpanAnnotationInput!\n) {\n  createSpanAnnotations(input: [$input]) {\n    spanAnnotations {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ed4fd3ecbab9ba161f24e4f9b297b00f";

export default node;
