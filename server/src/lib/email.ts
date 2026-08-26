import nodemailer from "nodemailer";

/**
 * Real SMTP email delivery via nodemailer — same pattern as scanner.ts and s3Storage.ts:
 * a genuine integration, auto-selected by env config, that degrades to a clearly-logged
 * no-op rather than pretending to succeed when unconfigured. Never sent to a real inbox in
 * this build (no SMTP credentials were available in this environment) — see the
 * verification-status note in docs/NOTIFICATIONS.md.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailResult {
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
}

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM ?? "noreply@nmtc-compliance.example";

const transport = host
  ? nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    })
  : null;

if (!transport) {
  console.warn(
    "SMTP_HOST is not set — email delivery is disabled. Notifications are still recorded " +
      'in-app and in the notifications table with status "failed", just never sent to an inbox.'
  );
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (!transport) {
    return { status: "failed", error: "SMTP not configured (SMTP_HOST unset)" };
  }
  try {
    const info = await transport.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.body,
    });
    return { status: "sent", providerMessageId: info.messageId };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}
