import {
  DropZone as ReactAriaDropZone,
  type DropZoneProps,
} from "react-aria-components";

import { dropZoneCSS } from "./styles";

export function DropZone({ ...props }: DropZoneProps) {
  return <ReactAriaDropZone {...props} css={dropZoneCSS} />;
}
