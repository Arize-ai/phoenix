import { Icon } from "../icon";
import {
  AlertCircle,
  AlertCircleFilled,
  AlertTriangle,
  AlertTriangleFilled,
  CheckmarkCircle,
  CheckmarkCircleFilled,
  Info,
  InfoFilled,
} from "../icon/Icons";
import type { SeverityLevel } from "../types";

type IconOptions = {
  /**
   * Whether or not the icon should be filled-in or outlined
   * @default true
   */
  filled?: boolean;
};
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
