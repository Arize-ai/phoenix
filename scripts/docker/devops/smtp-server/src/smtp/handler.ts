import {
  SMTPServer,
  type SMTPServerDataStream,
  type SMTPServerSession,
} from "smtp-server";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { randomUUID } from "crypto";
import type {
  Email,
  EmailAddress,
  EmailAttachment,
  SMTPSessionInfo,
} from "../types/index.js";

export class SMTPHandler {
  private emails: Email[] = [];
  private readonly maxEmails: number;
  private server: SMTPServer;
  private port: number;
  constructor(port: number, maxEmails = 1000) {
    this.port = port;
    this.maxEmails = maxEmails;

    this.server = new SMTPServer({
      allowInsecureAuth: true,
      authOptional: true,
      secure: false,
      banner: "Phoenix Development SMTP Server",
      logger: false,
      onConnect: this.handleConnect.bind(this),
      onData: this.handleData.bind(this),
      onMailFrom: this.handleMailFrom.bind(this),
      onRcptTo: this.handleRcptTo.bind(this),
      onAuth: this.handleAuth.bind(this),
    });
  }

  private handleConnect(
    session: SMTPServerSession,
    callback: (error?: Error) => void
  ): void {
    callback();
  }

  private handleAuth(
    auth: any,
    session: SMTPServerSession,
    callback: (error?: Error | null, response?: any) => void
  ): void {
    callback(null, { user: auth.username || "dev" });
  }

  private handleMailFrom(
    address: { address: string; args: Record<string, string | boolean> },
    session: SMTPServerSession,
    callback: (error?: Error) => void
  ): void {
    callback();
  }

  private handleRcptTo(
    address: { address: string; args: Record<string, string | boolean> },
    session: SMTPServerSession,
    callback: (error?: Error) => void
  ): void {
    callback();
  }

  private async handleData(
    stream: SMTPServerDataStream,
    session: SMTPServerSession,
    callback: (error?: Error) => void
  ): Promise<void> {
    try {
      const sessionInfo: SMTPSessionInfo = {
        remoteAddress: session.remoteAddress,
        clientHostname: session.clientHostname,
        openingCommand: session.openingCommand,
        hostNameAppearsAs: session.hostNameAppearsAs,
        transmissionType: session.transmissionType,
      };

      console.log("📥 Receiving email data...", sessionInfo);

      const parsed = await simpleParser(stream);
      const email = this.convertParsedMailToEmail(parsed, sessionInfo);

      this.addEmail(email);

      console.log(`✅ Email received: ${email.subject} (${email.id})`);
      callback();
    } catch (error) {
      console.error("❌ Error processing email:", error);
      callback(error instanceof Error ? error : new Error("Unknown error"));
    }
  }

  private convertParsedMailToEmail(
    parsed: ParsedMail,
    sessionInfo: SMTPSessionInfo
  ): Email {
    const convertAddresses = (
      addresses: AddressObject | AddressObject[] | undefined
    ): EmailAddress[] => {
      if (!addresses) return [];

      const addressArray = Array.isArray(addresses) ? addresses : [addresses];

      return addressArray.flatMap((addr) =>
        addr.value.map((v: any) => ({
          name: v.name,
          address: v.address || "",
        }))
      );
    };

    const convertAttachments = (
      attachments: ParsedMail["attachments"]
    ): EmailAttachment[] => {
      if (!attachments) return [];

      return attachments.map((att: any) => ({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        content: att.content.toString("base64"),
      }));
    };

    const textLength = typeof parsed.text === "string" ? parsed.text.length : 0;
    const htmlLength = typeof parsed.html === "string" ? parsed.html.length : 0;
    const attachmentsSize =
      parsed.attachments?.reduce(
        (sum: number, att: any) => sum + att.size,
        0
      ) || 0;
    const size = textLength + htmlLength + attachmentsSize;

    const email: Email = {
      id: randomUUID(),
      to: convertAddresses(parsed.to),
      subject: parsed.subject || "(No Subject)",
      timestamp: parsed.date || new Date(),
      size,
    };

    // Only include optional properties if they exist (for exactOptionalPropertyTypes compatibility)
    if (parsed.messageId) {
      email.messageId = parsed.messageId;
    }

    const fromAddress = parsed.from
      ? convertAddresses(parsed.from)[0]
      : undefined;
    if (fromAddress) {
      email.from = fromAddress;
    }

    const ccAddresses = convertAddresses(parsed.cc);
    if (ccAddresses.length > 0) {
      email.cc = ccAddresses;
    }

    const bccAddresses = convertAddresses(parsed.bcc);
    if (bccAddresses.length > 0) {
      email.bcc = bccAddresses;
    }

    if (typeof parsed.text === "string") {
      email.text = parsed.text;
    }

    if (typeof parsed.html === "string") {
      email.html = parsed.html;
    }

    const attachments = convertAttachments(parsed.attachments);
    if (attachments.length > 0) {
      email.attachments = attachments;
    }

    if (parsed.headers) {
      email.headers = Object.fromEntries(parsed.headers);
    }

    return email;
  }

  private addEmail(email: Email): void {
    this.emails.unshift(email);

    if (this.emails.length > this.maxEmails) {
      this.emails = this.emails.slice(0, this.maxEmails);
    }

    console.log(`📧 Email received: ${email.subject} (${email.id})`);
  }

  public getEmails(
    page = 1,
    pageSize = 50
  ): { emails: Email[]; total: number; page: number; pageSize: number } {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return {
      emails: this.emails.slice(startIndex, endIndex),
      total: this.emails.length,
      page,
      pageSize,
    };
  }

  public getEmailById(id: string): Email | undefined {
    return this.emails.find((email) => email.id === id);
  }

  public deleteEmail(id: string): boolean {
    const initialLength = this.emails.length;
    this.emails = this.emails.filter((email) => email.id !== id);
    return this.emails.length < initialLength;
  }

  public clearAllEmails(): number {
    const count = this.emails.length;
    this.emails = [];
    return count;
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (error?: any) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }

  public getStats() {
    return {
      totalEmails: this.emails.length,
      maxEmails: this.maxEmails,
      oldestEmail: this.emails[this.emails.length - 1]?.timestamp,
      newestEmail: this.emails[0]?.timestamp,
    };
  }
}
