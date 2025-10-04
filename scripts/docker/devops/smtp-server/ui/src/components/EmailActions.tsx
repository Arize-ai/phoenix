import { Mail, Trash2, RefreshCw } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle.js";

interface EmailActionsProps {
  emailCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  onClearAll: () => void;
}

export function EmailActions({
  emailCount,
  isLoading,
  onRefresh,
  onClearAll,
}: EmailActionsProps) {
  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Email Debugger
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {emailCount} email{emailCount !== 1 ? "s" : ""} collected
      </div>
    </div>
  );
}
