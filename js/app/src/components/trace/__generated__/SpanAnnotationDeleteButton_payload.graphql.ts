/**
 * @generated SignedSource<<c38f9f2d2411eec8d45c6610e8e2c44d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanAnnotationDeleteButton_payload$data = {
  readonly query: {
    readonly node: {
      readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup" | "SpanAnnotationsEditor_spanAnnotations" | "SpanAnnotationsTable_annotations">;
    };
  };
  readonly " $fragmentType": "SpanAnnotationDeleteButton_payload";
};
export type SpanAnnotationDeleteButton_payload$key = {
  readonly " $data"?: SpanAnnotationDeleteButton_payload$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanAnnotationDeleteButton_payload">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "kind": "RootArgument",
      "name": "filterUserIds"
    },
    {
      "kind": "RootArgument",
      "name": "spanId"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "SpanAnnotationDeleteButton_payload",
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
          "args": [
            {
              "kind": "Variable",
              "name": "id",
              "variableName": "spanId"
            }
          ],
          "concreteType": null,
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            {
              "kind": "InlineFragment",
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "AnnotationSummaryGroup"
                },
                {
                  "args": [
                    {
                      "kind": "Variable",
                      "name": "filterUserIds",
                      "variableName": "filterUserIds"
                    }
                  ],
                  "kind": "FragmentSpread",
                  "name": "SpanAnnotationsEditor_spanAnnotations"
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "SpanAnnotationsTable_annotations"
                }
              ],
              "type": "Span",
              "abstractKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "SpanAnnotationMutationPayload",
  "abstractKey": null
};

(node as any).hash = "5ea97887a987458b33965d3b45fc89f4";

export default node;
