/**
 * @generated SignedSource<<93264ea748ae73c84ac6b50cd12c6eb7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectAnnotationConfigCardContent_project_annotations$data = {
  readonly annotationConfigs: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly name?: string;
      };
    }>;
  };
  readonly id: string;
  readonly " $fragmentType": "ProjectAnnotationConfigCardContent_project_annotations";
};
export type ProjectAnnotationConfigCardContent_project_annotations$key = {
  readonly " $data"?: ProjectAnnotationConfigCardContent_project_annotations$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectAnnotationConfigCardContent_project_annotations">;
};

import ProjectAnnotationConfigCardContentProjectAnnotationsQuery_graphql from './ProjectAnnotationConfigCardContentProjectAnnotationsQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ProjectAnnotationConfigCardContentProjectAnnotationsQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectAnnotationConfigCardContent_project_annotations",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "AnnotationConfigConnection",
      "kind": "LinkedField",
      "name": "annotationConfigs",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "AnnotationConfigEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "name",
                      "storageKey": null
                    }
                  ],
                  "type": "AnnotationConfigBase",
                  "abstractKey": "__isAnnotationConfigBase"
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "f7049daf44d5f6a2e085c04cc187e86e";

export default node;
