/**
 * @generated SignedSource<<86c2b293d4d0ba25fe9b1b5ccc0ef213>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE";
export type CreateContinuousAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  upperBound?: number | null;
};
export type SettingsAnnotationsPageCreateContinuousAnnotationConfigMutation$variables = {
  input: CreateContinuousAnnotationConfigInput;
};
export type SettingsAnnotationsPageCreateContinuousAnnotationConfigMutation$data = {
  readonly createContinuousAnnotationConfig: {
    readonly annotationConfig: {
      readonly id: string;
    };
  };
};
export type SettingsAnnotationsPageCreateContinuousAnnotationConfigMutation = {
  response: SettingsAnnotationsPageCreateContinuousAnnotationConfigMutation$data;
  variables: SettingsAnnotationsPageCreateContinuousAnnotationConfigMutation$variables;
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
    "concreteType": "CreateContinuousAnnotationConfigPayload",
    "kind": "LinkedField",
    "name": "createContinuousAnnotationConfig",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ContinuousAnnotationConfig",
        "kind": "LinkedField",
        "name": "annotationConfig",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsAnnotationsPageCreateContinuousAnnotationConfigMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsAnnotationsPageCreateContinuousAnnotationConfigMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ccb793e489099b6a752a27d20a982533",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageCreateContinuousAnnotationConfigMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAnnotationsPageCreateContinuousAnnotationConfigMutation(\n  $input: CreateContinuousAnnotationConfigInput!\n) {\n  createContinuousAnnotationConfig(input: $input) {\n    annotationConfig {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "060477f577600afd1337a7138b71d0bc";

export default node;
