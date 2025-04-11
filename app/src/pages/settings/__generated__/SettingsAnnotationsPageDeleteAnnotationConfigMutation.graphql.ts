/**
 * @generated SignedSource<<acea4279b21f37d7d19c487bc950d7b0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteAnnotationConfigInput = {
  configId: string;
};
export type SettingsAnnotationsPageDeleteAnnotationConfigMutation$variables = {
  input: DeleteAnnotationConfigInput;
};
export type SettingsAnnotationsPageDeleteAnnotationConfigMutation$data = {
  readonly deleteAnnotationConfig: {
    readonly annotationConfig: {
      readonly __typename: string;
    };
  };
};
export type SettingsAnnotationsPageDeleteAnnotationConfigMutation = {
  response: SettingsAnnotationsPageDeleteAnnotationConfigMutation$data;
  variables: SettingsAnnotationsPageDeleteAnnotationConfigMutation$variables;
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsAnnotationsPageDeleteAnnotationConfigMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteAnnotationConfigPayload",
        "kind": "LinkedField",
        "name": "deleteAnnotationConfig",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "annotationConfig",
            "plural": false,
            "selections": [
              (v2/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsAnnotationsPageDeleteAnnotationConfigMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteAnnotationConfigPayload",
        "kind": "LinkedField",
        "name": "deleteAnnotationConfig",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "annotationConfig",
            "plural": false,
            "selections": [
              (v2/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "id",
                    "storageKey": null
                  }
                ],
                "type": "Node",
                "abstractKey": "__isNode"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b6b9260d58a6721c5dc81f7596766a39",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageDeleteAnnotationConfigMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAnnotationsPageDeleteAnnotationConfigMutation(\n  $input: DeleteAnnotationConfigInput!\n) {\n  deleteAnnotationConfig(input: $input) {\n    annotationConfig {\n      __typename\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "705e44815f407f6f7403516604019253";

export default node;
