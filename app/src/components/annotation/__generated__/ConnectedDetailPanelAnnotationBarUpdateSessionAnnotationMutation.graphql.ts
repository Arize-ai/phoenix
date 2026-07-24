/**
 * @generated SignedSource<<1a0134734f1addfe64a37c8b21d07b4d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type UpdateAnnotationInput = {
  annotatorKind?: AnnotatorKind;
  explanation?: string | null;
  id: string;
  label?: string | null;
  metadata: any;
  name: string;
  score?: number | null;
  source?: AnnotationSource;
};
export type ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation$variables = {
  input: UpdateAnnotationInput;
};
export type ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation$data = {
  readonly updateProjectSessionAnnotations: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation = {
  response: ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation$data;
  variables: ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation$variables;
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
    "name": "updateProjectSessionAnnotations",
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
    "name": "ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "6e9c9da7852f5d5e8d16ad2faa17c5a9",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation(\n  $input: UpdateAnnotationInput!\n) {\n  updateProjectSessionAnnotations(input: $input) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4e9aa4eb6abd3f66fd734a23c8688af2";

export default node;
