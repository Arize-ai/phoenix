/**
 * @generated SignedSource<<ae94875f8eb021e20f709152e9bf4f46>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateFreeformAnnotationConfigInput = {
  description?: string | null;
  name: string;
};
export type SettingsAnnotationsPageCreateFreeformAnnotationConfigMutation$variables = {
  input: CreateFreeformAnnotationConfigInput;
};
export type SettingsAnnotationsPageCreateFreeformAnnotationConfigMutation$data = {
  readonly createFreeformAnnotationConfig: {
    readonly annotationConfig: {
      readonly id: string;
    };
  };
};
export type SettingsAnnotationsPageCreateFreeformAnnotationConfigMutation = {
  response: SettingsAnnotationsPageCreateFreeformAnnotationConfigMutation$data;
  variables: SettingsAnnotationsPageCreateFreeformAnnotationConfigMutation$variables;
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
    "concreteType": "CreateFreeformAnnotationConfigPayload",
    "kind": "LinkedField",
    "name": "createFreeformAnnotationConfig",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "FreeformAnnotationConfig",
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
    "name": "SettingsAnnotationsPageCreateFreeformAnnotationConfigMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsAnnotationsPageCreateFreeformAnnotationConfigMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "d0e852b90511a2f27c8631070aa3f243",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageCreateFreeformAnnotationConfigMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAnnotationsPageCreateFreeformAnnotationConfigMutation(\n  $input: CreateFreeformAnnotationConfigInput!\n) {\n  createFreeformAnnotationConfig(input: $input) {\n    annotationConfig {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5314fd5c5f598b35ed06e4c716d0f967";

export default node;
