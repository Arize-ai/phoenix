/**
 * @generated SignedSource<<e6a46a0e00cf46afc8f0ce6fcdedcd66>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionProjectEvaluatorDetailsTestQuery$variables = Record<PropertyKey, never>;
export type DecisionProjectEvaluatorDetailsTestQuery$data = {
  readonly projectEvaluator: {
    readonly " $fragmentSpreads": FragmentRefs<"DecisionProjectEvaluatorDetails_projectEvaluator">;
  };
};
export type DecisionProjectEvaluatorDetailsTestQuery = {
  response: DecisionProjectEvaluatorDetailsTestQuery$data;
  variables: DecisionProjectEvaluatorDetailsTestQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "test-project-evaluator-id"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "instructions",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "String"
},
v7 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "ID"
},
v8 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "String"
},
v9 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "Float"
},
v10 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "JSON"
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionProjectEvaluatorDetailsTestQuery",
    "selections": [
      {
        "alias": "projectEvaluator",
        "args": (v0/*:: as any*/),
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
                "name": "DecisionProjectEvaluatorDetails_projectEvaluator"
              }
            ],
            "type": "ProjectEvaluator",
            "abstractKey": null
          }
        ],
        "storageKey": "node(id:\"test-project-evaluator-id\")"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DecisionProjectEvaluatorDetailsTestQuery",
    "selections": [
      {
        "alias": "projectEvaluator",
        "args": (v0/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v1/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "EvaluatorInputMapping",
                "kind": "LinkedField",
                "name": "inputMapping",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "literalMapping",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "pathMapping",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v1/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionScoringPolicy",
                        "kind": "LinkedField",
                        "name": "scoringPolicy",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "questions",
                            "plural": true,
                            "selections": [
                              (v1/*:: as any*/),
                              (v2/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "optimizationDirection",
                                "storageKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "threshold",
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionPredicateScoring",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DecisionChoiceScore",
                                    "kind": "LinkedField",
                                    "name": "scores",
                                    "plural": true,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "choice",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "score",
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionChoiceScoring",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "includeLabel",
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionScaleScoring",
                                "abstractKey": null
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
                        "concreteType": "DecisionVersion",
                        "kind": "LinkedField",
                        "name": "decisionVersion",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "decisionId",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Decision",
                            "kind": "LinkedField",
                            "name": "decision",
                            "plural": false,
                            "selections": [
                              (v2/*:: as any*/),
                              (v3/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "modelName",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "modelProvider",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "state",
                            "plural": false,
                            "selections": [
                              (v1/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "template",
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionTextState",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "input",
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionInputState",
                                "abstractKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "questions",
                            "plural": true,
                            "selections": [
                              (v1/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v2/*:: as any*/),
                                  (v4/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DecisionPredicateCriteria",
                                    "kind": "LinkedField",
                                    "name": "criteria",
                                    "plural": false,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "true",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "false",
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionPredicateQuestion",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v2/*:: as any*/),
                                  (v4/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DecisionChoiceOption",
                                    "kind": "LinkedField",
                                    "name": "choices",
                                    "plural": true,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "value",
                                        "storageKey": null
                                      },
                                      (v5/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionChoiceQuestion",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v2/*:: as any*/),
                                  (v4/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DecisionScaleLevel",
                                    "kind": "LinkedField",
                                    "name": "levels",
                                    "plural": true,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "label",
                                        "storageKey": null
                                      },
                                      (v5/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionScaleQuestion",
                                "abstractKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionEvaluator",
                    "abstractKey": null
                  },
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "ProjectEvaluator",
            "abstractKey": null
          },
          (v3/*:: as any*/)
        ],
        "storageKey": "node(id:\"test-project-evaluator-id\")"
      }
    ]
  },
  "params": {
    "cacheID": "fbcc2b13fe56b4760912d65612ccc1bd",
    "id": null,
    "metadata": {
      "relayTestingSelectionTypeInfo": {
        "projectEvaluator": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Node"
        },
        "projectEvaluator.__typename": (v6/*:: as any*/),
        "projectEvaluator.evaluator": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Evaluator"
        },
        "projectEvaluator.evaluator.__typename": (v6/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "DecisionVersion"
        },
        "projectEvaluator.evaluator.decisionVersion.decision": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Decision"
        },
        "projectEvaluator.evaluator.decisionVersion.decision.id": (v7/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.decision.name": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Identifier"
        },
        "projectEvaluator.evaluator.decisionVersion.decisionId": (v7/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.id": (v7/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.modelName": (v6/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.modelProvider": {
          "enumValues": [
            "OPENAI",
            "ANTHROPIC",
            "AZURE_OPENAI",
            "GOOGLE",
            "DEEPSEEK",
            "XAI",
            "OLLAMA",
            "AWS",
            "CEREBRAS",
            "FIREWORKS",
            "GROQ",
            "MOONSHOT",
            "MINIMAX",
            "PERPLEXITY",
            "TOGETHER",
            "ZAI",
            "META",
            "TYPESAFE"
          ],
          "nullable": false,
          "plural": false,
          "type": "GenerativeProviderKey"
        },
        "projectEvaluator.evaluator.decisionVersion.questions": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "DecisionQuestion"
        },
        "projectEvaluator.evaluator.decisionVersion.questions.__typename": (v6/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.questions.choices": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "DecisionChoiceOption"
        },
        "projectEvaluator.evaluator.decisionVersion.questions.choices.description": (v8/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.questions.choices.value": (v6/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.questions.criteria": {
          "enumValues": null,
          "nullable": true,
          "plural": false,
          "type": "DecisionPredicateCriteria"
        },
        "projectEvaluator.evaluator.decisionVersion.questions.criteria.false": (v8/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.questions.criteria.true": (v8/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.questions.instructions": (v6/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.questions.levels": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "DecisionScaleLevel"
        },
        "projectEvaluator.evaluator.decisionVersion.questions.levels.description": (v8/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.questions.levels.label": (v6/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.questions.name": (v6/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.state": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "DecisionState"
        },
        "projectEvaluator.evaluator.decisionVersion.state.__typename": (v6/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.state.input": (v6/*:: as any*/),
        "projectEvaluator.evaluator.decisionVersion.state.template": (v6/*:: as any*/),
        "projectEvaluator.evaluator.id": (v7/*:: as any*/),
        "projectEvaluator.evaluator.scoringPolicy": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "DecisionScoringPolicy"
        },
        "projectEvaluator.evaluator.scoringPolicy.questions": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "DecisionQuestionScoring"
        },
        "projectEvaluator.evaluator.scoringPolicy.questions.__typename": (v6/*:: as any*/),
        "projectEvaluator.evaluator.scoringPolicy.questions.includeLabel": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Boolean"
        },
        "projectEvaluator.evaluator.scoringPolicy.questions.name": (v6/*:: as any*/),
        "projectEvaluator.evaluator.scoringPolicy.questions.optimizationDirection": {
          "enumValues": [
            "MINIMIZE",
            "MAXIMIZE",
            "NONE"
          ],
          "nullable": false,
          "plural": false,
          "type": "OptimizationDirection"
        },
        "projectEvaluator.evaluator.scoringPolicy.questions.scores": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "DecisionChoiceScore"
        },
        "projectEvaluator.evaluator.scoringPolicy.questions.scores.choice": (v6/*:: as any*/),
        "projectEvaluator.evaluator.scoringPolicy.questions.scores.score": (v9/*:: as any*/),
        "projectEvaluator.evaluator.scoringPolicy.questions.threshold": (v9/*:: as any*/),
        "projectEvaluator.id": (v7/*:: as any*/),
        "projectEvaluator.inputMapping": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "EvaluatorInputMapping"
        },
        "projectEvaluator.inputMapping.literalMapping": (v10/*:: as any*/),
        "projectEvaluator.inputMapping.pathMapping": (v10/*:: as any*/)
      }
    },
    "name": "DecisionProjectEvaluatorDetailsTestQuery",
    "operationKind": "query",
    "text": "query DecisionProjectEvaluatorDetailsTestQuery {\n  projectEvaluator: node(id: \"test-project-evaluator-id\") {\n    __typename\n    ... on ProjectEvaluator {\n      ...DecisionProjectEvaluatorDetails_projectEvaluator\n    }\n    id\n  }\n}\n\nfragment DecisionProjectEvaluatorDetails_projectEvaluator on ProjectEvaluator {\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    ... on DecisionEvaluator {\n      scoringPolicy {\n        questions {\n          __typename\n          name\n          optimizationDirection\n          ... on DecisionPredicateScoring {\n            threshold\n          }\n          ... on DecisionChoiceScoring {\n            scores {\n              choice\n              score\n            }\n          }\n          ... on DecisionScaleScoring {\n            includeLabel\n          }\n        }\n      }\n      decisionVersion {\n        id\n        decisionId\n        decision {\n          name\n          id\n        }\n        modelName\n        modelProvider\n        state {\n          __typename\n          ... on DecisionTextState {\n            template\n          }\n          ... on DecisionInputState {\n            input\n          }\n        }\n        questions {\n          __typename\n          ... on DecisionPredicateQuestion {\n            name\n            instructions\n            criteria {\n              true\n              false\n            }\n          }\n          ... on DecisionChoiceQuestion {\n            name\n            instructions\n            choices {\n              value\n              description\n            }\n          }\n          ... on DecisionScaleQuestion {\n            name\n            instructions\n            levels {\n              label\n              description\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "0cfb4505ccf4ba4e9f0b65c53cedd5b5";

export default node;
