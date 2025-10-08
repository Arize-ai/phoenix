import { useState, useEffect } from "react";
import { EmailActions } from "./EmailActions.js";
import { EmailList } from "./EmailList.js";
import { EmailViewer } from "./EmailViewer.js";
import type { Email } from "../types/index.js";

export function EmailDebugger() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/mail/api/emails");
      const result = await response.json();
      if (result.success) {
        setEmails(result.data.emails);
      }
    } catch (error) {
      console.error("Failed to load emails:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteEmail = async (id: string) => {
    try {
      await fetch(`/mail/api/emails/${id}`, { method: "DELETE" });
      await loadEmails();
      if (selectedEmail?.id === id) {
        setSelectedEmail(null);
      }
    } catch (error) {
      console.error("Failed to delete email:", error);
    }
  };

  const clearAllEmails = async () => {
    if (!confirm("Clear all emails?")) return;
    try {
      await fetch("/mail/api/emails", { method: "DELETE" });
      await loadEmails();
      setSelectedEmail(null);
    } catch (error) {
      console.error("Failed to clear emails:", error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Email List Panel */}
      <div className="w-1/2 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <EmailActions
          emailCount={emails.length}
          isLoading={isLoading}
          onRefresh={loadEmails}
          onClearAll={clearAllEmails}
        />
        <div className="flex-1 overflow-y-auto">
          <EmailList
            emails={emails}
            selectedEmail={selectedEmail}
            onSelectEmail={setSelectedEmail}
            onDeleteEmail={deleteEmail}
          />
        </div>
      </div>

      {/* Email Viewer Panel */}
      <div className="w-1/2 bg-white dark:bg-gray-800 flex flex-col">
        <EmailViewer email={selectedEmail} />
      </div>
    </div>
  );
}
