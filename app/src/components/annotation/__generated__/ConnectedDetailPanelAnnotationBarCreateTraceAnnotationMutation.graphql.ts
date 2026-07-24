/**
 * @generated SignedSource<<14fa0407d7ad50d5b6e32d33a7c8778d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type CreateTraceAnnotationInput = {
  annotatorKind: AnnotatorKind;
  explanation?: string | null;
  identifier?: string | null;
  label?: string | null;
  metadata: any;
  name: string;
  score?: number | null;
  source: AnnotationSource;
  traceId: string;
};
export type ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation$variables = {
  input: CreateTraceAnnotationInput;
};
export type ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation$data = {
  readonly createTraceAnnotations: {
    readonly traceAnnotations: ReadonlyArray<{
      readonly id: string;
    }>;
  };
};
export type ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation = {
  response: ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation$data;
  variables: ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation$variables;
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
    "name": "createTraceAnnotations",
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
    "name": "ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "7a9506c9ca87a4734cc107bff4009552",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation(\n  $input: CreateTraceAnnotationInput!\n) {\n  createTraceAnnotations(input: [$input]) {\n    traceAnnotations {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8b7c1178f36230284f8b551e0b3a1ab2";

export default node;
