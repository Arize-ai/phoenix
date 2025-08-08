import { Token } from "@phoenix/components/token";

export function SequenceNumberToken({
  sequenceNumber,
  color = "var(--ac-global-color-yellow-500)",
}: {
  sequenceNumber: number;
  color?: string;
}) {
  return (
    <Token color={color} size="S">
      #{sequenceNumber}
    </Token>
  );
}
