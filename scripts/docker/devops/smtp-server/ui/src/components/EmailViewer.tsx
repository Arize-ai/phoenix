import { useState } from "react";
import { Mail, Eye, Code, FileText, Settings } from "lucide-react";
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
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p>Select an email to view its content</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Email Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
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
      <div className="flex-1 flex flex-col">
        {/* Content Type Selector */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2">
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
                className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${
                  contentType === type
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Display */}
        <div className="flex-1 overflow-y-auto p-4">
          {contentType === "html" && email.html ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  HTML Content:
                </div>
                <button
                  onClick={() => setShowHtmlSource(!showHtmlSource)}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300"
                >
                  {showHtmlSource ? "👁️ Show Rendered" : "🔍 Show Source"}
                </button>
              </div>
              {showHtmlSource ? (
                <div className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-gray-50 dark:bg-gray-800">
                  <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {email.html}
                  </pre>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden bg-white dark:bg-gray-900">
                  <iframe
                    srcDoc={email.html}
                    className="w-full h-96 border-0"
                    sandbox="allow-same-origin"
                    title="Email HTML Content"
                  />
                </div>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {showHtmlSource
                  ? "📋 Raw HTML source code"
                  : "📋 Rendered in iframe for proper styling isolation"}
              </div>
            </div>
          ) : contentType === "text" && email.text ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Text Content:
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-gray-50 dark:bg-gray-800 whitespace-pre-wrap font-mono text-sm text-gray-900 dark:text-gray-100">
                {email.text}
              </div>
            </div>
          ) : contentType === "raw" ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Raw Email Data:
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-gray-50 dark:bg-gray-800 whitespace-pre-wrap font-mono text-xs overflow-x-auto text-gray-900 dark:text-gray-100">
                {JSON.stringify(email, null, 2)}
              </div>
            </div>
          ) : contentType === "headers" && email.headers ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Email Headers:
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-gray-50 dark:bg-gray-800">
                <div className="space-y-1 font-mono text-xs">
                  {Object.entries(email.headers).map(([key, value]) => (
                    <div
                      key={key}
                      className="border-b border-gray-100 dark:border-gray-700 pb-1"
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
            <div className="text-gray-500 dark:text-gray-400 text-center">
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
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Attachments ({email.attachments.length}):
              </div>
              <div className="space-y-2">
                {email.attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800"
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
