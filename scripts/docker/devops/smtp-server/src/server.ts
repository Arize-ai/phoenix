#!/usr/bin/env node

import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
  type FastifyReply,
} from "fastify";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { SMTPHandler } from "./smtp/handler.js";
import {
  ServerConfigSchema,
  type EmailListResponse,
  type EmailResponse,
  type ApiResponse,
} from "./types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configResult = ServerConfigSchema.safeParse({
  smtpPort: parseInt(process.env.SMTP_PORT || "1025"),
  webPort: parseInt(process.env.WEB_PORT || "8025"),
  host: process.env.HOST || "0.0.0.0",
  maxEmails: parseInt(process.env.MAX_EMAILS || "1000"),
  allowedHosts: process.env.ALLOWED_HOSTS?.split(",").map((h) => h.trim()),
});

if (!configResult.success) {
  console.error("❌ Invalid configuration:", configResult.error.format());
  process.exit(1);
}

const config = configResult.data;

const fastify: FastifyInstance = Fastify({
  logger: true,
});

const smtpHandler = new SMTPHandler(config.smtpPort, config.maxEmails);

async function setupServer(): Promise<void> {
  await fastify.register(cors, {
    origin: ["http://localhost:5173", "http://localhost:4173"],
    credentials: true,
  });

  await fastify.register(staticFiles, {
    root: join(__dirname, "../ui/dist/assets"),
    prefix: "/assets/",
    decorateReply: false,
  });

  await fastify.register(staticFiles, {
    root: join(__dirname, "../ui/dist"),
    prefix: "/",
    decorateReply: false,
  });

  fastify.get("/api/health", async () => ({
    success: true,
    data: { status: "healthy" },
  }));

  fastify.get(
    "/api/emails",
    async (
      request: FastifyRequest<{
        Querystring: { page?: string; pageSize?: string };
      }>
    ) => {
      const page = parseInt(request.query.page || "1");
      const pageSize = parseInt(request.query.pageSize || "50");
      return { success: true, data: smtpHandler.getEmails(page, pageSize) };
    }
  );

  fastify.get(
    "/api/emails/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const email = smtpHandler.getEmailById(request.params.id);
      if (!email) {
        throw new Error("Email not found");
      }
      return { success: true, data: email };
    }
  );

  fastify.delete(
    "/api/emails/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const deleted = smtpHandler.deleteEmail(request.params.id);
      return { success: true, data: { deleted } };
    }
  );

  fastify.delete("/api/emails", async () => {
    const cleared = smtpHandler.clearAllEmails();
    return { success: true, data: { cleared } };
  });

  fastify.get("/api/stats", async () => {
    const stats = smtpHandler.getStats();
    return {
      success: true,
      data: {
        totalEmails: stats.totalEmails,
        uptime: process.uptime().toFixed(2) + "s",
      },
    };
  });

  fastify.setNotFoundHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ success: false, error: "Not found" });
      }
      return reply.sendFile("index.html");
    }
  );
}

fastify.setErrorHandler(async (error, request, reply) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  fastify.log.error({ error, request: request.url }, "Request error");

  return reply.code(statusCode).send({ success: false, error: message });
});

async function closeGracefully(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

  try {
    await smtpHandler.stop();
    console.log("✅ SMTP server stopped");

    await fastify.close();
    console.log("✅ Web server stopped");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  try {
    console.log("🚀 Starting Phoenix Development SMTP Server...");
    console.log("================================================");
    console.log(`📧 SMTP Port: ${config.smtpPort}`);
    console.log(`🌐 Web Port: ${config.webPort}`);
    console.log(`🏠 Host: ${config.host}`);
    console.log(`📨 Max Emails: ${config.maxEmails}`);

    await setupServer();

    await smtpHandler.start();
    console.log(`✅ SMTP server listening on port ${config.smtpPort}`);

    await fastify.listen({
      port: config.webPort,
      host: config.host,
    });
    console.log(
      `✅ Web server listening on http://${config.host}:${config.webPort}`
    );
    console.log("");
    console.log("📧 Send emails to any address @localhost");
    console.log(`🌐 View emails at: http://localhost:${config.webPort}`);
    console.log("");
    console.log("Press Ctrl+C to stop the server");

    process.on("SIGTERM", () => closeGracefully("SIGTERM"));
    process.on("SIGINT", () => closeGracefully("SIGINT"));
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Startup error:", error);
    process.exit(1);
  });
}

export { fastify };
