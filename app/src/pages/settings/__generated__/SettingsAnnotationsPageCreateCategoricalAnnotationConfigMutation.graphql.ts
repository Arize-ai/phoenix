/**
 * @generated SignedSource<<0cea6a211a12e37d344acdf10bc57c5c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE";
export type CreateCategoricalAnnotationConfigInput = {
  description?: string | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  values: ReadonlyArray<CategoricalAnnotationValueInput>;
};
export type CategoricalAnnotationValueInput = {
  label: string;
  score?: number | null;
};
export type SettingsAnnotationsPageCreateCategoricalAnnotationConfigMutation$variables = {
  input: CreateCategoricalAnnotationConfigInput;
};
export type SettingsAnnotationsPageCreateCategoricalAnnotationConfigMutation$data = {
  readonly createCategoricalAnnotationConfig: {
    readonly annotationConfig: {
      readonly id: string;
    };
  };
};
export type SettingsAnnotationsPageCreateCategoricalAnnotationConfigMutation = {
  response: SettingsAnnotationsPageCreateCategoricalAnnotationConfigMutation$data;
  variables: SettingsAnnotationsPageCreateCategoricalAnnotationConfigMutation$variables;
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
    "concreteType": "CreateCategoricalAnnotationConfigPayload",
    "kind": "LinkedField",
    "name": "createCategoricalAnnotationConfig",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "CategoricalAnnotationConfig",
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
    "name": "SettingsAnnotationsPageCreateCategoricalAnnotationConfigMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsAnnotationsPageCreateCategoricalAnnotationConfigMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "f3aa4e8ff8bfbd3afd3850e3fdb76f63",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageCreateCategoricalAnnotationConfigMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAnnotationsPageCreateCategoricalAnnotationConfigMutation(\n  $input: CreateCategoricalAnnotationConfigInput!\n) {\n  createCategoricalAnnotationConfig(input: $input) {\n    annotationConfig {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "01c3d186bdadc4f8ee51f5ab49462481";

export default node;
