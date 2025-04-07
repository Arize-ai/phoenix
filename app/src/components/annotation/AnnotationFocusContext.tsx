import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";

/**
 * A context for managing the focus state of wrapped components.
 *
 * It provides a handler for children to register themselves as part of the context,
 * as well as utilities for moving focus between the registered components.
 *
 * e.g. When all child components are registered, context will automatically focus the first child.
 * e.g. A restart button can be used to reset focus to the first child.
 */
export const AnnotationFocusContext =
  createContext<AnnotationFocusContextType | null>(null);

export type AnnotationFocusContextType = {
  register: (ref: React.RefObject<HTMLElement>) => void;
  unregister: (ref: React.RefObject<HTMLElement>) => void;
  moveFocus: (direction: "forward" | "backward") => void;
  resetFocus: () => void;
};

/**
 * Find the deepest focusable element within a given element.
 */
const deeplyFocus = (el: HTMLElement | null) => {
  if (!el) {
    return;
  }
  const focusableElements = el.querySelectorAll(
    "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
  ) as unknown as HTMLElement[];
  focusableElements[0]?.focus();
};

export const AnnotationFocusProvider = ({
  children,
  autoFocus,
}: {
  children: React.ReactNode;
  /**
   * If provided, the first registered component will be focused after mount.
   */
  autoFocus?: boolean;
}) => {
  const [registeredComponents, setRegisteredComponents] = useState<
    React.RefObject<HTMLElement>[]
  >([]);

  const register = useCallback(
    (ref: React.RefObject<HTMLElement>) => {
      setRegisteredComponents((prev) => [...prev, ref]);
    },
    [setRegisteredComponents]
  );

  const unregister = useCallback(
    (ref: React.RefObject<HTMLElement>) => {
      setRegisteredComponents((prev) => prev.filter((r) => r !== ref));
    },
    [setRegisteredComponents]
  );

  const moveFocus = useCallback(
    (direction: "forward" | "backward", loop = true) => {
      const currentIndex = registeredComponents.findIndex(
        (r) =>
          r.current === document.activeElement ||
          r.current?.contains(document.activeElement)
      );
      if (currentIndex === -1) {
        return;
      }

      let nextIndex =
        direction === "forward" ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex < 0 || nextIndex >= registeredComponents.length) {
        if (loop) {
          nextIndex =
            direction === "forward" ? 0 : registeredComponents.length - 1;
        } else {
          return;
        }
      }
      deeplyFocus(registeredComponents[nextIndex].current);
    },
    [registeredComponents]
  );

  const resetFocus = useCallback(() => {
    deeplyFocus(registeredComponents[0].current);
  }, [registeredComponents]);

  const modifierKey = useModifierKey();
  // Move forward through form inputs, wrapping around if the end is reached
  useHotkeys(
    modifierKey.toLowerCase() === "cmd" ? `ctrl+n` : `ctrl+shift+n`,
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentIndex = registeredComponents.findIndex(
        (r) =>
          r.current === document.activeElement ||
          r.current?.contains(e.target as Node)
      );
      if (currentIndex === -1) {
        return;
      }
      // only trigger if the target is one of the registered components
      // or its child
      moveFocus("forward");
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
      document: document,
    }
  );

  useLayoutEffect(() => {
    const firstComponent = registeredComponents[0]?.current;
    if (autoFocus && firstComponent) {
      deeplyFocus(firstComponent);
    }
  }, [autoFocus, registeredComponents]);

  return (
    <AnnotationFocusContext.Provider
      value={{ register, unregister, moveFocus, resetFocus }}
    >
      {children}
    </AnnotationFocusContext.Provider>
  );
};

export const useAnnotationFocus = () => {
  const ctx = useContext(AnnotationFocusContext);
  if (!ctx) {
    throw new Error(
      "useAnnotationFocus must be used within a AnnotationFocusProvider"
    );
  }
  return ctx;
};
