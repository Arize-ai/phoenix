import { Mail, Eye, Code, FileText, Settings } from "lucide-react";
import { useState } from "react";

import type { Email, EmailContentType } from "../types/index.js";

interface EmailViewerProps {
  email: Email | null;
}

function formatDate(timestamp: string | Date) {
  return new Date(timestamp).toLocaleString();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailViewer({ email }: EmailViewerProps) {
  const [contentType, setContentType] = useState<EmailContentType>("html");
  const [showHtmlSource, setShowHtmlSource] = useState(false);

  if (!email) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Mail className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p>Select an email to view its content</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Email Header */}
      <div className="border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {email.subject || "(No Subject)"}
        </h2>
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <div>
            <strong>From:</strong> {email.from?.address || "Unknown"}
          </div>
          <div>
            <strong>To:</strong>{" "}
            {email.to.map((t) => t.address).join(", ") || "No recipients"}
          </div>
          {email.cc && email.cc.length > 0 && (
            <div>
              <strong>CC:</strong> {email.cc.map((c) => c.address).join(", ")}
            </div>
          )}
          <div>
            <strong>Date:</strong> {formatDate(email.timestamp)}
          </div>
          <div>
            <strong>Size:</strong> {formatSize(email.size)}
          </div>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex flex-1 flex-col">
        {/* Content Type Selector */}
        <div className="border-b border-gray-200 px-4 py-2 dark:border-gray-700">
          <div className="flex space-x-1">
            {[
              { type: "html" as EmailContentType, label: "HTML", icon: Eye },
              {
                type: "text" as EmailContentType,
                label: "Text",
                icon: FileText,
              },
              { type: "raw" as EmailContentType, label: "Raw", icon: Code },
              {
                type: "headers" as EmailContentType,
                label: "Headers",
                icon: Settings,
              },
            ].map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setContentType(type)}
                className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${
                  contentType === type
                    ? "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Display */}
        <div className="flex-1 overflow-y-auto p-4">
          {contentType === "html" && email.html ? (
            <div className="space-y-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  HTML Content:
                </div>
                <button
                  onClick={() => setShowHtmlSource(!showHtmlSource)}
                  className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  {showHtmlSource ? "👁️ Show Rendered" : "🔍 Show Source"}
                </button>
              </div>
              {showHtmlSource ? (
                <div className="rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                  <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {email.html}
                  </pre>
                </div>
              ) : (
                <div className="overflow-hidden rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                  <iframe
                    srcDoc={email.html}
                    className="h-96 w-full border-0"
                    sandbox="allow-same-origin"
                    title="Email HTML Content"
                  />
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {showHtmlSource
                  ? "📋 Raw HTML source code"
                  : "📋 Rendered in iframe for proper styling isolation"}
              </div>
            </div>
          ) : contentType === "text" && email.text ? (
            <div className="space-y-2">
              <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                Text Content:
              </div>
              <div className="rounded border border-gray-200 bg-gray-50 p-4 font-mono text-sm whitespace-pre-wrap text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                {email.text}
              </div>
            </div>
          ) : contentType === "raw" ? (
            <div className="space-y-2">
              <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                Raw Email Data:
              </div>
              <div className="overflow-x-auto rounded border border-gray-200 bg-gray-50 p-4 font-mono text-xs whitespace-pre-wrap text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                {JSON.stringify(email, null, 2)}
              </div>
            </div>
          ) : contentType === "headers" && email.headers ? (
            <div className="space-y-2">
              <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                Email Headers:
              </div>
              <div className="rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="space-y-1 font-mono text-xs">
                  {Object.entries(email.headers).map(([key, value]) => (
                    <div
                      key={key}
                      className="border-b border-gray-100 pb-1 dark:border-gray-700"
                    >
                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                        {key}:
                      </span>{" "}
                      <span className="text-gray-700 dark:text-gray-300">
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <div>
                {contentType === "html" &&
                  !email.html &&
                  "No HTML content available"}
                {contentType === "text" &&
                  !email.text &&
                  "No text content available"}
                {contentType === "headers" &&
                  !email.headers &&
                  "No headers available"}
              </div>
            </div>
          )}

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                Attachments ({email.attachments.length}):
              </div>
              <div className="space-y-2">
                {email.attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {att.filename}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({att.contentType}) - {formatSize(att.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
