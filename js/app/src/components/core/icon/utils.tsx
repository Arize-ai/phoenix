import type { SeverityLevel } from "../types";
import { Icon } from "./Icon";
import {
  AlertCircle,
  AlertCircleFilled,
  AlertTriangle,
  AlertTriangleFilled,
  CheckmarkCircle,
  CheckmarkCircleFilled,
  Info,
  InfoFilled,
} from "./Icons";

type IconOptions = {
  /**
   * Whether or not the icon should be filled-in or outlined
   * @default true
   */
  filled?: boolean;
};
/**
 * The icon that stands for a severity level, so alerts, badges, and tooltips
 * agree on which glyph means "warning" or "success".
 */
export function getSeverityIcon(
  severity: SeverityLevel,
  { filled }: IconOptions = { filled: true }
) {
  let svg;
  switch (severity) {
    case "warning":
      svg = filled ? <AlertTriangleFilled /> : <AlertTriangle />;
      break;
    case "info":
      svg = filled ? <InfoFilled /> : <Info />;
      break;
    case "danger":
      svg = filled ? <AlertCircleFilled /> : <AlertCircle />;
      break;
    case "success":
      svg = filled ? <CheckmarkCircleFilled /> : <CheckmarkCircle />;
      break;
  }
  return <Icon svg={svg} />;
}
