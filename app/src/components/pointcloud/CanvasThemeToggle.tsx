import React from "react";

import { Button, Icon, MoonOutline, SunOutline } from "@arizeai/components";

import { usePointCloudContext } from "@phoenix/contexts";

export function CanvasThemeToggle() {
  const { canvasTheme, setCanvasTheme } = usePointCloudContext((state) => ({
    canvasTheme: state.canvasTheme,
    setCanvasTheme: state.setCanvasTheme,
  }));
  return (
    <Button
      variant={"default"}
      size="compact"
      icon={
        <Icon svg={canvasTheme === "dark" ? <MoonOutline /> : <SunOutline />} />
      }
      aria-label="Toggle canvas background color"
      onClick={() => {
        setCanvasTheme(canvasTheme === "dark" ? "light" : "dark");
      }}
    />
  );
}
