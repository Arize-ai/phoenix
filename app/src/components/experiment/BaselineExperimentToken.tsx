import { Icon, Icons, Token } from "@phoenix/components";

export function BaselineExperimentToken({ size = "S" }: { size?: "S" | "M" }) {
  return (
    <Token
      size={size}
      color="var(--global-color-purple-600)"
      leadingVisual={<Icon svg={<Icons.PriceTags />} />}
      title="Baseline experiment"
      maxWidth="100%"
    >
      baseline
    </Token>
  );
}
