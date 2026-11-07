import { graphql } from "react-relay";

/** Spread with `@relay(mask: false)` to read a `DecisionEvaluatorData`. */
export const decisionEvaluatorFragment = graphql`
  fragment decisionEvaluatorFragment_evaluator on DecisionEvaluator {
    id
    name
    inputSchema
    scoringPolicy {
      questions {
        __typename
        name
        optimizationDirection
        ... on DecisionPredicateScoring {
          threshold
        }
        ... on DecisionChoiceScoring {
          scores {
            choice
            score
          }
        }
        ... on DecisionScaleScoring {
          includeLabel
        }
      }
    }
    decisionVersion {
      id
      decision {
        id
        name
      }
      questions {
        __typename
        ... on DecisionPredicateQuestion {
          name
        }
        ... on DecisionChoiceQuestion {
          name
          choices {
            value
          }
        }
        ... on DecisionScaleQuestion {
          name
          levels {
            label
          }
        }
      }
    }
  }
`;
