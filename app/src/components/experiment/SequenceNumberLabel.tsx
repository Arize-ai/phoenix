import React from "react";

import { Label } from "@arizeai/components";

export function SequenceNumberLabel({
  sequenceNumber,
}: {
  sequenceNumber: number;
}) {
  return <Label color="yellow-1000">#{sequenceNumber}</Label>;
}
