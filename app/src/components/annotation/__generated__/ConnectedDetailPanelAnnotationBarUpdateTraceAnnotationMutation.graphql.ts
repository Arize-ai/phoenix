/**
 * @generated SignedSource<<11f2403a09496b54e1e1b49912f98986>>
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
export type ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation$variables = {
  input: PatchAnnotationInput;
};
export type ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation$data = {
  readonly patchTraceAnnotations: {
    readonly traceAnnotations: ReadonlyArray<{
      readonly id: string;
    }>;
  };
};
export type ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation = {
  response: ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation$data;
  variables: ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation$variables;
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
    "concreteType": "TraceAnnotationMutationPayload",
    "kind": "LinkedField",
    "name": "patchTraceAnnotations",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "TraceAnnotation",
        "kind": "LinkedField",
        "name": "traceAnnotations",
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
    "name": "ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "df839813e9d173a93b2173b71f099f0f",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation(\n  $input: PatchAnnotationInput!\n) {\n  patchTraceAnnotations(input: [$input]) {\n    traceAnnotations {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0e752e229ff6d52c9b7493d94d9a9da6";

export default node;
