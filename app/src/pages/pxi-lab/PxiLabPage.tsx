import { css, Global } from "@emotion/react";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { useSearchParams } from "react-router";

import {
  Button,
  Flex,
  Heading,
  Icon,
  Icons,
  Slider,
  SliderNumberField,
  Switch,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  View,
} from "@phoenix/components";
import { ThemeProvider } from "@phoenix/contexts";
import { GlobalStyles } from "@phoenix/GlobalStyles";

import type { PxiLabConfig, PxiRingState, PxiTreatment } from "./pxiLabConfig";
import {
  DEFAULT_PXI_LAB_CONFIG,
  parsePxiLabConfig,
  PXI_PALETTES,
  PXI_TREATMENTS,
  serializePxiLabConfig,
} from "./pxiLabConfig";
import { PxiLabScenarios } from "./PxiLabScenarios";
import { pxiGlobalCSS, pxiScopeCSS } from "./solveWithPxiStyles";

const pageCSS = css`
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
`;

const canvasCSS = css`
  flex: 1;
  overflow: auto;
  padding: var(--global-dimension-static-size-200);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: var(--global-dimension-static-size-200);
  align-items: start;
`;

const paneCSS = css`
  border-radius: var(--global-rounding-medium);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default, var(--global-color-gray-300));
  background-color: var(--global-background-color-default);
  color: var(--global-text-color-900);
  padding: var(--global-dimension-static-size-300);
`;

const sidebarCSS = css`
  width: 340px;
  flex: none;
  overflow-y: auto;
  border-left: var(--global-border-size-thin) solid
    var(--global-border-color-default, var(--global-color-gray-300));
  padding: var(--global-dimension-static-size-200);
`;

const swatchCSS = css`
  width: 44px;
  height: 24px;
  border-radius: var(--global-rounding-small);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default, var(--global-color-gray-300));
  cursor: pointer;
  padding: 0;
  &[data-focus-visible] {
    outline: var(--global-border-size-thick) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`;

const colorInputCSS = css`
  width: 44px;
  height: 28px;
  padding: 0;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default, var(--global-color-gray-300));
  border-radius: var(--global-rounding-small);
  background: none;
  cursor: pointer;
`;

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Flex direction="column" gap="size-75">
      <Text size="XS" color="text-500">
        {label}
      </Text>
      {children}
    </Flex>
  );
}

function singleKey<T extends string>(
  selection: Iterable<unknown>,
  isValid: (key: unknown) => key is T
): T | null {
  const first = [...selection][0];
  return isValid(first) ? first : null;
}

const isTreatment = (key: unknown): key is PxiTreatment =>
  PXI_TREATMENTS.some((t) => t.id === key);
const isRingState = (key: unknown): key is PxiRingState =>
  key === "idle" || key === "eligible" || key === "active";

/**
 * Temporary exploration playground for the "Solve with PXI" affordance
 * family. Renders every compositional form (trigger button, quiet icon,
 * hover-reveal, ring decorator, provenance tag, menu item) against realistic
 * Phoenix host surfaces in light and dark simultaneously, with every knob of
 * the active stylistic treatment adjustable in the sidebar. Config lives in
 * the URL, so a tuned direction is a shareable link.
 */
export function PxiLabPage() {
  const [, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState<PxiLabConfig>(() =>
    parsePxiLabConfig(new URLSearchParams(window.location.search))
  );

  const update = (partial: Partial<PxiLabConfig>) => {
    const next = { ...config, ...partial };
    setConfig(next);
    setSearchParams(serializePxiLabConfig(next), { replace: true });
  };

  const sliderChange =
    (key: keyof PxiLabConfig) => (value: number | number[]) =>
      update({ [key]: Array.isArray(value) ? value[0] : value });

  const treatment = PXI_TREATMENTS.find((t) => t.id === config.treatment);

  const scopeVars = {
    "--pxi-c1": config.c1,
    "--pxi-c2": config.c2,
    "--pxi-c3": config.c3,
    "--pxi-speed": `${config.speed}s`,
    "--pxi-ring-width": `${config.ringWidth}px`,
    "--pxi-glow": config.glow,
    "--pxi-spread": `${config.spread}px`,
    "--pxi-radius": `${config.radius}px`,
    ...(config.pill ? { "--pxi-button-radius": "9999px" } : {}),
  } as CSSProperties;

  return (
    <main css={pageCSS}>
      <Global styles={pxiGlobalCSS} />
      <div css={canvasCSS}>
        {(["light", "dark"] as const).map((theme) => (
          <ThemeProvider key={theme} themeMode={theme} disableBodyTheme>
            {/* each provider instance emits its theme's .theme--{theme} token
                block, same as Storybook's side-by-side ThemedStory */}
            <GlobalStyles />
            <div
              className={`theme theme--${theme} pxi-scope`}
              data-theme={theme}
              data-pxi-treatment={config.treatment}
              data-pxi-motion={config.motion ? "on" : "off"}
              style={scopeVars}
              css={[paneCSS, pxiScopeCSS]}
            >
              <Flex direction="column" gap="size-300">
                <Text size="XS" color="text-300">
                  {theme === "light" ? "Light" : "Dark"}
                </Text>
                <PxiLabScenarios ringState={config.ringState} />
              </Flex>
            </div>
          </ThemeProvider>
        ))}
      </div>
      <aside css={sidebarCSS}>
        <Flex direction="column" gap="size-300">
          <Flex direction="column" gap="size-50">
            <Heading level={2}>Solve with PXI lab</Heading>
            <Text size="XS" color="text-500">
              Treatments are pure CSS token sets — tune, copy the config, or
              share the URL.
            </Text>
          </Flex>

          <ControlGroup label="Treatment">
            <ToggleButtonGroup
              selectionMode="single"
              size="S"
              selectedKeys={[config.treatment]}
              onSelectionChange={(selection) => {
                const key = singleKey(selection, isTreatment);
                if (key) {
                  update({ treatment: key });
                }
              }}
            >
              {PXI_TREATMENTS.map((t) => (
                <ToggleButton key={t.id} id={t.id}>
                  {t.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {treatment && (
              <Text size="XS" color="text-500">
                {treatment.description}
              </Text>
            )}
          </ControlGroup>

          <ControlGroup label="Palette">
            <Flex direction="row" gap="size-75" wrap>
              {PXI_PALETTES.map((palette) => (
                <AriaButton
                  key={palette.id}
                  aria-label={`${palette.label} palette`}
                  css={swatchCSS}
                  style={{
                    background: `linear-gradient(90deg, ${palette.c1}, ${palette.c2}, ${palette.c3})`,
                  }}
                  onPress={() =>
                    update({ c1: palette.c1, c2: palette.c2, c3: palette.c3 })
                  }
                />
              ))}
            </Flex>
            <Flex direction="row" gap="size-75" alignItems="center">
              {(["c1", "c2", "c3"] as const).map((key) => (
                <input
                  key={key}
                  type="color"
                  aria-label={`Gradient stop ${key}`}
                  css={colorInputCSS}
                  value={config[key]}
                  onChange={(event) => update({ [key]: event.target.value })}
                />
              ))}
            </Flex>
          </ControlGroup>

          <ControlGroup label="Geometry & intensity">
            <Slider
              label="Ring width"
              minValue={0.5}
              maxValue={4}
              step={0.5}
              value={config.ringWidth}
              onChange={sliderChange("ringWidth")}
            >
              <SliderNumberField />
            </Slider>
            <Slider
              label="Corner radius"
              minValue={0}
              maxValue={24}
              step={1}
              value={config.radius}
              onChange={sliderChange("radius")}
            >
              <SliderNumberField />
            </Slider>
            <Slider
              label="Glow intensity"
              minValue={0}
              maxValue={1}
              step={0.05}
              value={config.glow}
              onChange={sliderChange("glow")}
            >
              <SliderNumberField />
            </Slider>
            <Slider
              label="Glow spread"
              minValue={2}
              maxValue={32}
              step={1}
              value={config.spread}
              onChange={sliderChange("spread")}
            >
              <SliderNumberField />
            </Slider>
          </ControlGroup>

          <ControlGroup label="Motion">
            <Slider
              label="Cycle duration (s)"
              minValue={0.5}
              maxValue={12}
              step={0.5}
              value={config.speed}
              onChange={sliderChange("speed")}
            >
              <SliderNumberField />
            </Slider>
            <Switch
              isSelected={config.motion}
              onChange={(isSelected) => update({ motion: isSelected })}
            >
              <Text size="S">Animate (off previews reduced motion)</Text>
            </Switch>
            <Switch
              isSelected={config.pill}
              onChange={(isSelected) => update({ pill: isSelected })}
            >
              <Text size="S">Pill-shaped buttons</Text>
            </Switch>
          </ControlGroup>

          <ControlGroup label="Ring state">
            <ToggleButtonGroup
              selectionMode="single"
              size="S"
              selectedKeys={[config.ringState]}
              onSelectionChange={(selection) => {
                const key = singleKey(selection, isRingState);
                if (key) {
                  update({ ringState: key });
                }
              }}
            >
              <ToggleButton id="idle">Idle</ToggleButton>
              <ToggleButton id="eligible">Eligible</ToggleButton>
              <ToggleButton id="active">Active</ToggleButton>
            </ToggleButtonGroup>
          </ControlGroup>

          <View paddingTop="size-100">
            <Flex direction="row" gap="size-100">
              <Button
                size="S"
                leadingVisual={<Icon svg={<Icons.Duplicate />} />}
                onPress={() =>
                  navigator.clipboard.writeText(JSON.stringify(config, null, 2))
                }
              >
                Copy config
              </Button>
              <Button
                size="S"
                variant="quiet"
                onPress={() => {
                  setConfig(DEFAULT_PXI_LAB_CONFIG);
                  setSearchParams(new URLSearchParams(), { replace: true });
                }}
              >
                Reset
              </Button>
            </Flex>
          </View>
        </Flex>
      </aside>
    </main>
  );
}
