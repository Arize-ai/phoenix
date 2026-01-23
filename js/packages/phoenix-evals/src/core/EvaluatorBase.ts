import {
  CreateEvaluatorArgs,
  EvaluationKind,
  EvaluationResult,
  EvaluatorInterface,
  OptimizationDirection,
  TelemetryConfig,
} from "../types";
import { ObjectMapping } from "../types/data";

/**
 * Base class for all evaluators
 */
export abstract class EvaluatorBase<
  RecordType extends Record<string, unknown>,
> implements EvaluatorInterface<RecordType> {
  readonly name: string;
  readonly kind: EvaluationKind;
  readonly optimizationDirection?: OptimizationDirection;
  readonly inputMapping?: ObjectMapping<RecordType>;
  readonly telemetry?: TelemetryConfig;
  constructor({
    name,
    kind,
    optimizationDirection,
    inputMapping,
    telemetry,
  }: CreateEvaluatorArgs<RecordType>) {
    this.name = name;
    this.kind = kind;
    this.optimizationDirection = optimizationDirection;
    this.inputMapping = inputMapping;
    this.telemetry = telemetry;
  }
  abstract evaluate(_example: RecordType): Promise<EvaluationResult>;

  /**
   * Binds the input mapping to the evaluator. It makes a a copy of the evaluator and returns it.
   */
  abstract bindInputMapping(
    inputMapping: ObjectMapping<RecordType>
  ): EvaluatorBase<RecordType>;
}
