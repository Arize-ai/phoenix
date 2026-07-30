import { Counter } from "@phoenix/components/core/counter";

export function TraceErrorCount({ errorCount }: { errorCount: number }) {
  if (errorCount <= 0) {
    return null;
  }
  const errorLabel = `${errorCount} error ${errorCount === 1 ? "span" : "spans"}`;
  return (
    <span aria-label={errorLabel} title={errorLabel}>
      <Counter variant="danger">{errorCount}</Counter>
    </span>
  );
}
