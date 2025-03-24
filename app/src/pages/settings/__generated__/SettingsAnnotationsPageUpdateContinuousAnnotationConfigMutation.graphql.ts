/**
 * @generated SignedSource<<b2f898187d700f2d6d54e850e56e1a05>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE";
export type UpdateContinuousAnnotationConfigInput = {
  configId: string;
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  upperBound?: number | null;
};
export type SettingsAnnotationsPageUpdateContinuousAnnotationConfigMutation$variables = {
  input: UpdateContinuousAnnotationConfigInput;
};
export type SettingsAnnotationsPageUpdateContinuousAnnotationConfigMutation$data = {
  readonly updateContinuousAnnotationConfig: {
    readonly annotationConfig: {
      readonly id: string;
    };
  };
};
export type SettingsAnnotationsPageUpdateContinuousAnnotationConfigMutation = {
  response: SettingsAnnotationsPageUpdateContinuousAnnotationConfigMutation$data;
  variables: SettingsAnnotationsPageUpdateContinuousAnnotationConfigMutation$variables;
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
    "concreteType": "UpdateContinuousAnnotationConfigPayload",
    "kind": "LinkedField",
    "name": "updateContinuousAnnotationConfig",
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
    "name": "SettingsAnnotationsPageUpdateContinuousAnnotationConfigMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsAnnotationsPageUpdateContinuousAnnotationConfigMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ac7a635ea53a2fea0c93f637ed824968",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageUpdateContinuousAnnotationConfigMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAnnotationsPageUpdateContinuousAnnotationConfigMutation(\n  $input: UpdateContinuousAnnotationConfigInput!\n) {\n  updateContinuousAnnotationConfig(input: $input) {\n    annotationConfig {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7aa888cdb8fa31fb423c86f97fc3a1d6";

export default node;
