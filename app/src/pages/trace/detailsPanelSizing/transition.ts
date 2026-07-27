/**
 * The executable interpretation of the rule table in `machine.ts`. This is
 * the production transition function: the adapter dispatches events through
 * it and renders from the state it returns. The proof harness reasons about
 * the same rule table via the SMT backend, so properties proven there hold
 * for the exact semantics implemented here.
 */

import type { Environment } from "./expr";
import { evaluateBool, evaluateInt } from "./expr";
import type {
  BoolField,
  IntField,
  SizingEffect,
  SizingEvent,
  SizingState,
  TransitionRule,
} from "./machine";
import { BOOL_FIELDS, INT_FIELDS, RULES } from "./machine";

export interface TransitionResult {
  readonly state: SizingState;
  readonly effects: readonly SizingEffect[];
}

const environmentFor = (state: SizingState, param: number): Environment => {
  const ints: Record<string, number> = { px: param };
  for (const field of INT_FIELDS) ints[field] = state[field];
  const bools: Record<string, boolean> = {};
  for (const field of BOOL_FIELDS) bools[field] = state[field];
  return { ints, bools };
};

const eventParam = (event: SizingEvent): number =>
  "px" in event ? event.px : 0;

/**
 * Apply one event. First rule (in table order) whose event and guard match is
 * applied with simultaneous-assignment semantics; if none matches, the state
 * is returned unchanged with no effects — the machine is total.
 */
export function transition(
  state: SizingState,
  event: SizingEvent,
  rules: readonly TransitionRule[] = RULES
): TransitionResult {
  const env = environmentFor(state, eventParam(event));
  for (const rule of rules) {
    if (rule.event !== event.type) continue;
    if (!evaluateBool(rule.guard, env)) continue;

    const next: Record<string, number | boolean> = { ...state };
    for (const field of INT_FIELDS) {
      const update = rule.updates[field as IntField];
      if (update) next[field] = evaluateInt(update, env);
    }
    for (const field of BOOL_FIELDS) {
      const update = rule.boolUpdates[field as BoolField];
      if (update) next[field] = evaluateBool(update, env);
    }

    const effects: SizingEffect[] = [];
    for (const effect of rule.effects) {
      if (evaluateBool(effect.when, env)) {
        effects.push({
          kind: effect.kind,
          value: evaluateInt(effect.value, env),
        });
      }
    }
    return { state: next as unknown as SizingState, effects };
  }
  return { state, effects: [] };
}
