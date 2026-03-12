import { css } from "@emotion/react";
import { useCallback, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useShallow } from "zustand/react/shallow";

import { Button, Flex, Label, Text } from "@phoenix/components";
import { SelectChevronUpDownIcon } from "@phoenix/components/icon";
import { ListBox, ListBoxItem } from "@phoenix/components/listbox";
import { Popover } from "@phoenix/components/overlay";
import { Select, SelectValue } from "@phoenix/components/select";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

import type { LanguageSelectorQuery } from "./__generated__/LanguageSelectorQuery.graphql";

type SupportedLanguage = "PYTHON" | "TYPESCRIPT";

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  PYTHON: "Python",
  TYPESCRIPT: "TypeScript",
};

export const LanguageSelector = () => {
  const { language, sandboxBackendType, setLanguage, setSandboxBackendType } =
    useEvaluatorStore(
      useShallow((state) => ({
        language: state.language,
        sandboxBackendType: state.sandboxBackendType,
        setLanguage: state.setLanguage,
        setSandboxBackendType: state.setSandboxBackendType,
      }))
    );

  const data = useLazyLoadQuery<LanguageSelectorQuery>(
    graphql`
      query LanguageSelectorQuery {
        sandboxBackends {
          key
          status
          supportedLanguages
        }
      }
    `,
    {}
  );

  const availableBackends = useMemo(
    () => data.sandboxBackends.filter((b) => b.status === "AVAILABLE"),
    [data.sandboxBackends]
  );

  const availableLanguages = useMemo(() => {
    const languageSet = new Set<SupportedLanguage>();
    for (const backend of availableBackends) {
      for (const lang of backend.supportedLanguages) {
        if (lang === "PYTHON" || lang === "TYPESCRIPT") {
          languageSet.add(lang);
        }
      }
    }
    return Array.from(languageSet).sort();
  }, [availableBackends]);

  const handleChange = useCallback(
    (value: unknown) => {
      if (value === "PYTHON" || value === "TYPESCRIPT") {
        setLanguage(value);
        // Check if current backend supports the new language
        const currentBackend = availableBackends.find(
          (b) => b.key === sandboxBackendType
        );
        if (
          currentBackend &&
          !currentBackend.supportedLanguages.includes(value)
        ) {
          // Find a backend that supports the new language and reset to it
          const compatibleBackend = availableBackends.find((b) =>
            b.supportedLanguages.includes(value)
          );
          if (compatibleBackend) {
            setSandboxBackendType(compatibleBackend.key);
          }
        }
      }
    },
    [setLanguage, setSandboxBackendType, availableBackends, sandboxBackendType]
  );

  if (availableLanguages.length === 0) {
    return (
      <Flex direction="column" gap="size-50">
        <Label>Language</Label>
        <Text color="text-300">No languages available</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="size-50">
      <Select
        selectionMode="single"
        value={language}
        onChange={handleChange}
        aria-label="Evaluator language"
      >
        <Label>Language</Label>
        <Button
          trailingVisual={<SelectChevronUpDownIcon />}
          size="S"
          css={css`
            width: 100%;
          `}
        >
          <SelectValue />
        </Button>
        <Popover
          css={css`
            width: var(--trigger-width);
          `}
        >
          <ListBox>
            {availableLanguages.map((lang) => (
              <ListBoxItem key={lang} id={lang} textValue={lang}>
                <Text>{LANGUAGE_LABELS[lang]}</Text>
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
      <Text size="XS" color="text-300">
        The programming language for your evaluator code
      </Text>
    </Flex>
  );
};
