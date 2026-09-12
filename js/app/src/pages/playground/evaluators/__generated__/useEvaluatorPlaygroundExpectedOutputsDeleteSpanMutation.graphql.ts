/**
 * @generated SignedSource<<37c986dfc10440d587aceca44139145f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteAnnotationsInput = {
  annotationIds: ReadonlyArray<string>;
};
export type useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation$variables = {
  input: DeleteAnnotationsInput;
};
export type useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation$data = {
  readonly deleteSpanAnnotations: {
    readonly spanAnnotations: ReadonlyArray<{
      readonly id: string;
    }>;
  };
};
export type useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation = {
  response: useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation$data;
  variables: useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation$variables;
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
    "concreteType": "SpanAnnotationMutationPayload",
    "kind": "LinkedField",
    "name": "deleteSpanAnnotations",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SpanAnnotation",
        "kind": "LinkedField",
        "name": "spanAnnotations",
        "plural": true,
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "74ef834dba23d17cb0422ebb73b8d588",
    "id": null,
    "metadata": {},
    "name": "useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation",
    "operationKind": "mutation",
    "text": "mutation useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation(\n  $input: DeleteAnnotationsInput!\n) {\n  deleteSpanAnnotations(input: $input) {\n    spanAnnotations {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "80a75a56f6d3aa50e686060012e21c19";

export default node;
