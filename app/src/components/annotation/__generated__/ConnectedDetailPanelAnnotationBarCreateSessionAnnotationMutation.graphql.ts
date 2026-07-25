/**
 * @generated SignedSource<<a4148fff6668b6d2dd629ce3c9132483>>
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
    readonly query: {
      readonly __typename: "Query";
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
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "query",
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
    "cacheID": "19ef122550ec441deab99204be02b755",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation(\n  $input: CreateProjectSessionAnnotationInput!\n) {\n  createProjectSessionAnnotations(input: $input) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "de52d62b2a8d19557b82fca3ac75e4c3";

export default node;
