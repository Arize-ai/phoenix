/**
 * @generated SignedSource<<5305445dad9dacf0dbca0737d8110b48>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE";
export type UpdateCategoricalAnnotationConfigInput = {
  configId: string;
  description?: string | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  values: ReadonlyArray<CategoricalAnnotationValueInput>;
};
export type CategoricalAnnotationValueInput = {
  label: string;
  score?: number | null;
};
export type SettingsAnnotationsPageUpdateCategoricalAnnotationConfigMutation$variables = {
  input: UpdateCategoricalAnnotationConfigInput;
};
export type SettingsAnnotationsPageUpdateCategoricalAnnotationConfigMutation$data = {
  readonly updateCategoricalAnnotationConfig: {
    readonly annotationConfig: {
      readonly id: string;
    };
  };
};
export type SettingsAnnotationsPageUpdateCategoricalAnnotationConfigMutation = {
  response: SettingsAnnotationsPageUpdateCategoricalAnnotationConfigMutation$data;
  variables: SettingsAnnotationsPageUpdateCategoricalAnnotationConfigMutation$variables;
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
    "concreteType": "UpdateCategoricalAnnotationConfigPayload",
    "kind": "LinkedField",
    "name": "updateCategoricalAnnotationConfig",
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
    "name": "SettingsAnnotationsPageUpdateCategoricalAnnotationConfigMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsAnnotationsPageUpdateCategoricalAnnotationConfigMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a510def70cbd4568d46c90431fc968d0",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageUpdateCategoricalAnnotationConfigMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAnnotationsPageUpdateCategoricalAnnotationConfigMutation(\n  $input: UpdateCategoricalAnnotationConfigInput!\n) {\n  updateCategoricalAnnotationConfig(input: $input) {\n    annotationConfig {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "be7ea1ff99c9ec48bcd887c8c2d99219";

export default node;
