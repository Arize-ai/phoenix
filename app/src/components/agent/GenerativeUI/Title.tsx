import { Heading } from "@phoenix/components/core/content";

export function Title({ text }: { text: string }) {
  return (
    <Heading level={4} weight="heavy">
      {text}
    </Heading>
  );
}
