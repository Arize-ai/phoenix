import React from "react";
import { css } from "@emotion/react";

import { Switch } from "@arizeai/components";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
  View,
} from "@phoenix/components";
import { useProjectContext } from "@phoenix/contexts/ProjectContext";

const buttonCSS = css`
  padding: var(--ac-global-dimension-static-size-100);
  border-radius: var(--ac-global-rounding-small);
`;

/**
 * A button that opens a configuration popover for project filters.
 * Currently allows configuring how orphan spans are treated in the trace view.
 */
export function ProjectFilterConfigButton() {
  const treatOrphansAsRoots = useProjectContext(
    (state) => state.treatOrphansAsRoots
  );
  const setTreatOrphansAsRoots = useProjectContext(
    (state) => state.setTreatOrphansAsRoots
  );
  return (
    <DialogTrigger>
      <Button
        size="M"
        css={buttonCSS}
        aria-label="Filter Configuration"
        leadingVisual={<Icon svg={<Icons.OptionsOutline />} />}
      />
      <Popover>
        <PopoverArrow />
        <Dialog>
          <View padding="size-100">
            <Flex direction="column" gap="size-100">
              <Switch
                isSelected={treatOrphansAsRoots}
                onChange={(isSelected) => {
                  setTreatOrphansAsRoots(isSelected);
                }}
              >
                Treat Orphan Spans as Roots
              </Switch>
            </Flex>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
