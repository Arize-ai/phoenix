import React, { useState } from "react";

import { Card } from "@arizeai/components";

import {
  Button,
  DialogTrigger,
  Popover,
  PopoverArrow,
} from "@phoenix/components";
import { AnnotationConfigDialog } from "@phoenix/pages/settings/AnnotationConfigDialog";
import { AnnotationConfigTable } from "@phoenix/pages/settings/AnnotationConfigTable";

type AnnotationConfigType = "continuous" | "categorical" | "text";

type AnnotationConfigBase = {
  id: string;
  name: string;
  type: AnnotationConfigType;
};

export type AnnotationConfigContinuous = AnnotationConfigBase & {
  type: "continuous";
  min: number;
  max: number;
};

export type AnnotationConfigCategorical = AnnotationConfigBase & {
  type: "categorical";
  values: { label: string }[];
};

export type AnnotationConfigText = AnnotationConfigBase & {
  type: "text";
};

export type AnnotationConfig =
  | AnnotationConfigContinuous
  | AnnotationConfigCategorical
  | AnnotationConfigText;

export const SettingsAnnotationsPage = () => {
  const [annotationConfigs, setAnnotationConfigs] = useState<
    AnnotationConfig[]
  >([
    {
      id: "1",
      name: "foo",
      type: "categorical",
      values: [
        { label: "foo" },
        { label: "bar" },
        { label: "baz" },
        { label: "qux" },
        { label: "quux" },
        { label: "foo" },
        { label: "bar" },
        { label: "baz" },
        { label: "qux" },
        { label: "quux" },
        { label: "foo" },
        { label: "bar" },
        { label: "baz" },
        { label: "qux" },
        { label: "quux" },
        { label: "foo" },
        { label: "bar" },
        { label: "baz" },
        { label: "qux" },
        { label: "quux" },
      ],
    },
  ]);

  const handleAddAnnotationConfig = (config: AnnotationConfig) => {
    setAnnotationConfigs([...annotationConfigs, config]);
  };

  const handleEditAnnotationConfig = (config: AnnotationConfig) => {
    setAnnotationConfigs(
      annotationConfigs.map((c) => (c.id === config.id ? config : c))
    );
  };

  return (
    <Card
      title="Annotations Settings"
      variant="compact"
      bodyStyle={{ padding: 0 }}
      extra={
        <DialogTrigger>
          <Button size="S">New Annotation Config</Button>
          <Popover placement="bottom end">
            <PopoverArrow />
            <AnnotationConfigDialog
              onAddAnnotationConfig={handleAddAnnotationConfig}
            />
          </Popover>
        </DialogTrigger>
      }
    >
      <AnnotationConfigTable
        annotationConfigs={annotationConfigs}
        onEditAnnotationConfig={handleEditAnnotationConfig}
      />
    </Card>
  );
};
