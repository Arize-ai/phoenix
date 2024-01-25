import React, { createContext, useCallback, useContext } from "react";

import { NoticeFn, useNotification } from "@arizeai/components";

// Extract the first argument of notify
type NoticeConfig = Parameters<NoticeFn>[0];
type NoticeConfigWithoutVariant = Omit<NoticeConfig, "variant">;
type NotificationContextType = {
  /**
   * Send a notification that is visible in any part of the UI
   */
  notify: NoticeFn;
  /**
   * Convenience function to notify of an error
   */
  notifyError: (notice: NoticeConfigWithoutVariant) => void;
  /**
   * Convenience function to notify of a success
   */
  notifySuccess: (notice: NoticeConfigWithoutVariant) => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notify, holder] = useNotification();

  const notifyError = useCallback(
    (notice: NoticeConfigWithoutVariant) => {
      notify({
        variant: "danger",
        ...notice,
      });
    },
    [notify],
  );

  const notifySuccess = useCallback(
    (notice: NoticeConfigWithoutVariant) => {
      notify({
        variant: "success",
        ...notice,
      });
    },
    [notify],
  );

  return (
    <NotificationContext.Provider
      value={{ notify, notifyError, notifySuccess }}
    >
      {children}
      {holder}
    </NotificationContext.Provider>
  );
}

export function useGlobalNotification() {
  const context = useContext(NotificationContext);
  if (context === null) {
    throw new Error(
      "useGlobalNotification must be used within a NotificationProvider",
    );
  }
  return context;
}

/**
 * Convenience hook to display an error at the global app level
 */
export function useNotifyError() {
  const context = useGlobalNotification();
  return context.notifyError;
}

/**
 * Convenience hook to display a success at the global app level
 */
export function useNotifySuccess() {
  const context = useGlobalNotification();
  return context.notifySuccess;
}
