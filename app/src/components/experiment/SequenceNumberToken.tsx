import { Token } from "@phoenix/components/token";

export function SequenceNumberToken({
  sequenceNumber,
}: {
  sequenceNumber: number;
}) {
  return (
    <Token color="var(--ac-global-color-yellow-500)" size="S">
      #{sequenceNumber}
    </Token>
  );
}
