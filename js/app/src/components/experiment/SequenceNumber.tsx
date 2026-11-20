import { css } from "@emotion/react";

const sequenceNumberCSS = css`
  flex: none;
  color: var(--global-text-color-500);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

/**
 * An experiment's position among its dataset's experiments ("#3"), in
 * subdued text sized by its context. A position is neither a count nor an
 * ID a person would copy, so it is text rather than a `Counter` or an
 * `Identifier`.
 */
export function SequenceNumber({ sequenceNumber }: { sequenceNumber: number }) {
  return (
    <span className="sequence-number" css={sequenceNumberCSS}>
      #{sequenceNumber}
    </span>
  );
}
