import { z } from "zod";
export * from "../shared/types.js";
import type { ApiResponse, Email, EmailListData } from "../shared/types.js";

export const EmailAddressSchema = z.object({
  name: z.string().optional(),
  address: z.string().email(),
});

export const EmailAttachmentSchema = z.object({
  filename: z.string().optional(),
  contentType: z.string(),
  size: z.number(),
  content: z.string(),
});

export const EmailSchema = z.object({
  id: z.string(),
  messageId: z.string().optional(),
  from: EmailAddressSchema.optional(),
  to: z.array(EmailAddressSchema),
  cc: z.array(EmailAddressSchema).optional(),
  bcc: z.array(EmailAddressSchema).optional(),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(EmailAttachmentSchema).optional(),
  timestamp: z.date(),
  size: z.number(),
  headers: z.record(z.string(), z.unknown()).optional(),
});

export const ServerConfigSchema = z.object({
  smtpPort: z.number().min(1).max(65535),
  webPort: z.number().min(1).max(65535),
  host: z.string(),
  maxEmails: z.number().min(1),
  allowedHosts: z.array(z.string()).optional(),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export type EmailListResponse = ApiResponse<EmailListData>;
export type EmailResponse = ApiResponse<Email>;

export interface SMTPSessionInfo {
  remoteAddress?: string;
  clientHostname?: string;
  openingCommand?: string;
  hostNameAppearsAs?: string;
  transmissionType?: string;
}
