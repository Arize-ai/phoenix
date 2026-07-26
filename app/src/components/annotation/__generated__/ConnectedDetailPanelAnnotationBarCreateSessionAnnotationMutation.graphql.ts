/**
 * @generated SignedSource<<33e27bceec73f680ea1502c88d29fff7>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type CreateProjectSessionAnnotationInput = {
  annotatorKind?: AnnotatorKind;
  explanation?: string | null;
  identifier?: string | null;
  label?: string | null;
  metadata: any;
  name: string;
  projectSessionId: string;
  score?: number | null;
  source?: AnnotationSource;
};
export type ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation$variables = {
  input: CreateProjectSessionAnnotationInput;
};
export type ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation$data = {
  readonly createProjectSessionAnnotations: {
    readonly projectSessionAnnotation: {
      readonly id: string;
    };
  };
};
export type ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation = {
  response: ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation$data;
  variables: ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation$variables;
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
    "concreteType": "ProjectSessionAnnotationMutationPayload",
    "kind": "LinkedField",
    "name": "createProjectSessionAnnotations",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ProjectSessionAnnotation",
        "kind": "LinkedField",
        "name": "projectSessionAnnotation",
        "plural": false,
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
    "name": "ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "d8af107414dbf617f7d9019cb2fec1f1",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation(\n  $input: CreateProjectSessionAnnotationInput!\n) {\n  createProjectSessionAnnotations(input: $input) {\n    projectSessionAnnotation {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8e782971da8989f10fcf17912dc3789d";

export default node;
