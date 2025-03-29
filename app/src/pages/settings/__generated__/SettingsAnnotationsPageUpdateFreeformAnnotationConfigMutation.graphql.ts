/**
 * @generated SignedSource<<fc895ed92565ac5ff11878fee0aaf01a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UpdateFreeformAnnotationConfigInput = {
  configId: string;
  description?: string | null;
  name: string;
};
export type SettingsAnnotationsPageUpdateFreeformAnnotationConfigMutation$variables = {
  input: UpdateFreeformAnnotationConfigInput;
};
export type SettingsAnnotationsPageUpdateFreeformAnnotationConfigMutation$data = {
  readonly updateFreeformAnnotationConfig: {
    readonly annotationConfig: {
      readonly id: string;
    };
  };
};
export type SettingsAnnotationsPageUpdateFreeformAnnotationConfigMutation = {
  response: SettingsAnnotationsPageUpdateFreeformAnnotationConfigMutation$data;
  variables: SettingsAnnotationsPageUpdateFreeformAnnotationConfigMutation$variables;
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
    "concreteType": "UpdateFreeformAnnotationConfigPayload",
    "kind": "LinkedField",
    "name": "updateFreeformAnnotationConfig",
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
    "name": "SettingsAnnotationsPageUpdateFreeformAnnotationConfigMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsAnnotationsPageUpdateFreeformAnnotationConfigMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "5e6391e273bd2437e38011d3798432e5",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageUpdateFreeformAnnotationConfigMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAnnotationsPageUpdateFreeformAnnotationConfigMutation(\n  $input: UpdateFreeformAnnotationConfigInput!\n) {\n  updateFreeformAnnotationConfig(input: $input) {\n    annotationConfig {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "91661190c4213a5a1e70995735a9c30c";

export default node;
