import { startTransition } from "react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
  Switch,
  View,
} from "@phoenix/components";
import { useProjectContext } from "@phoenix/contexts/ProjectContext";

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
  const showTableAside = useProjectContext((state) => state.showTableAside);
  const setShowTableAside = useProjectContext(
    (state) => state.setShowTableAside
  );
  return (
    <DialogTrigger>
      <Button
        size="M"
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
                  startTransition(() => {
                    setTreatOrphansAsRoots(isSelected);
                  });
                }}
              >
                Treat Orphan Spans as Roots
              </Switch>
              <Switch
                isSelected={showTableAside}
                onChange={(isSelected) => {
                  startTransition(() => {
                    setShowTableAside(isSelected);
                  });
                }}
              >
                Show Table Aside
              </Switch>
            </Flex>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
