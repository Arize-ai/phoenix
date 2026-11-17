export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailAttachment {
  filename?: string;
  contentType: string;
  size: number;
  content: string;
}

export interface Email {
  id: string;
  messageId?: string;
  from?: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  timestamp: Date | string;
  size: number;
  headers?: Record<string, unknown>;
}

export type ApiResponse<T = unknown> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
      details?: unknown;
    };

export interface EmailListData {
  emails: Email[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ServerStats {
  totalEmails: number;
  maxEmails?: number;
  oldestEmail?: Date | string;
  newestEmail?: Date | string;
  uptime?: string;
}

export interface EmailFilters {
  search: string;
  page: number;
  pageSize: number;
}

export interface EmailViewMode {
  mode: "list" | "preview" | "fullscreen";
  selectedEmailId?: string;
}

export type EmailContentType = "text" | "html" | "raw" | "headers";
