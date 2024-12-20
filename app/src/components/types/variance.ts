export type BaseVariant = "primary" | "default";
export type LevelVariant = "success" | "danger" | "info";

export type Variant = BaseVariant | LevelVariant;

export interface VarianceProps {
  /**
   * The variant of the component
   * @default 'default'
   */
  variant?: Variant;
}
