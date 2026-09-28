import type { Transporter } from "nodemailer";

/**
 * Official-email channel for notifications (portal spec §60: "Portal
 * notification + Official email"). Off unless EMAIL_NOTIFICATIONS_ENABLED is
 * "true", so development and test runs never send real mail.
 *
 * Settings: EMAIL_ADDRESS / EMAIL_PASSWORD (the sending mailbox), optional
 * SMTP_HOST (default smtp.gmail.com), SMTP_PORT (default 465, TLS), and
 * EMAIL_FROM_NAME (default "CAIAS Consultancy Portal").
 *
 * EMAIL_ALLOWLIST (optional, comma-separated addresses): when set, only those
 * recipients are emailed — a safety net for testing against a database that
 * holds real staff. Leave it unset in production.
 */
export function emailNotificationsEnabled(): boolean {
  return process.env.EMAIL_NOTIFICATIONS_ENABLED === "true" && Boolean(process.env.EMAIL_ADDRESS && process.env.EMAIL_PASSWORD);
}

let transporter: Promise<Transporter> | null = null;

function getTransporter(): Promise<Transporter> {
  transporter ??= import("nodemailer").then((nodemailer) => {
    const port = Number(process.env.SMTP_PORT ?? 465);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.EMAIL_ADDRESS, pass: process.env.EMAIL_PASSWORD },
    });
  });
  return transporter;
}

/**
 * Sends one notification email. Never throws: a mail-server problem must not
 * roll back or fail the workflow action that raised the notification — the
 * portal notification is already on record either way.
 */
export async function sendNotificationEmail(input: { to: string; subject: string; text: string }): Promise<void> {
  if (!emailNotificationsEnabled()) return;
  const allowlist = process.env.EMAIL_ALLOWLIST?.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (allowlist?.length && !allowlist.includes(input.to.toLowerCase())) {
    console.info("[email] skipped (not in EMAIL_ALLOWLIST)", { to: input.to, subject: input.subject });
    return;
  }
  try {
    const mailer = await getTransporter();
    const fromName = process.env.EMAIL_FROM_NAME ?? "CAIAS Consultancy Portal";
    await mailer.sendMail({ from: `"${fromName}" <${process.env.EMAIL_ADDRESS}>`, to: input.to, subject: input.subject, text: input.text });
  } catch (error) {
    console.error("[email] notification email failed", { to: input.to, error: error instanceof Error ? error.message : error });
  }
}
