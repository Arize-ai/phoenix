/**
 * @generated SignedSource<<3422641644534afcfe75a4c6c9bedc32>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteAnnotationConfigsInput = {
  ids: ReadonlyArray<string>;
};
export type SettingsAnnotationsPageDeleteAnnotationConfigsMutation$variables = {
  input: DeleteAnnotationConfigsInput;
};
export type SettingsAnnotationsPageDeleteAnnotationConfigsMutation$data = {
  readonly deleteAnnotationConfigs: {
    readonly annotationConfigs: ReadonlyArray<{
      readonly __typename: string;
    }>;
  };
};
export type SettingsAnnotationsPageDeleteAnnotationConfigsMutation = {
  response: SettingsAnnotationsPageDeleteAnnotationConfigsMutation$data;
  variables: SettingsAnnotationsPageDeleteAnnotationConfigsMutation$variables;
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
    "name": "SettingsAnnotationsPageDeleteAnnotationConfigsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteAnnotationConfigsPayload",
        "kind": "LinkedField",
        "name": "deleteAnnotationConfigs",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "annotationConfigs",
            "plural": true,
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
    "name": "SettingsAnnotationsPageDeleteAnnotationConfigsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DeleteAnnotationConfigsPayload",
        "kind": "LinkedField",
        "name": "deleteAnnotationConfigs",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "annotationConfigs",
            "plural": true,
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
    "cacheID": "26434e94a78f9d52aa61c8e885eb5ca3",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageDeleteAnnotationConfigsMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAnnotationsPageDeleteAnnotationConfigsMutation(\n  $input: DeleteAnnotationConfigsInput!\n) {\n  deleteAnnotationConfigs(input: $input) {\n    annotationConfigs {\n      __typename\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b9c71db625b896a55591c5d5e88a2929";

export default node;
