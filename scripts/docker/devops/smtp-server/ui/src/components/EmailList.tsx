import { Mail, User, AtSign, Clock, Trash2 } from "lucide-react";

import type { Email } from "../types/index.js";

interface EmailListProps {
  emails: Email[];
  selectedEmail: Email | null;
  onSelectEmail: (email: Email) => void;
  onDeleteEmail: (id: string) => void;
}

function formatDate(timestamp: string | Date) {
  return new Date(timestamp).toLocaleString();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailList({
  emails,
  selectedEmail,
  onSelectEmail,
  onDeleteEmail,
}: EmailListProps) {
  if (emails.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Mail className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p>No emails yet</p>
          <p className="text-sm">Send an email to see it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {emails.map((email) => (
        <div
          key={email.id}
          className={`cursor-pointer p-4 hover:bg-gray-50 dark:hover:bg-gray-700 ${
            selectedEmail?.id === email.id
              ? "border-r-2 border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
              : ""
          }`}
          onClick={() => onSelectEmail(email)}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {email.from?.address || "Unknown"}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <AtSign className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <span className="truncate text-sm text-gray-600 dark:text-gray-300">
                  {email.to[0]?.address || "No recipient"}
                </span>
              </div>
              <h3 className="mt-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {email.subject || "(No Subject)"}
              </h3>
              <div className="mt-2 flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(email.timestamp)}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatSize(email.size)}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEmail(email.id);
              }}
              className="ml-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
