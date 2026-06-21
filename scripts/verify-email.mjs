#!/usr/bin/env node
/**
 * Standalone Gmail/SMTP connectivity + send check — proves the transactional
 * email credentials work end to end, independent of the Next app.
 *
 *   node --env-file=.env scripts/verify-email.mjs [recipient]
 *
 * Reads SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / EMAIL_FROM from the
 * environment and sends one test email to [recipient] (defaults to SMTP_USER,
 * i.e. your own inbox). Use this to confirm the Gmail App Password before wiring
 * it into Vercel.
 */
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? 465);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.EMAIL_FROM ?? `Test <${user}>`;
const to = process.argv[2] ?? user;

if (!host || !user || !pass) {
  console.error("✗ Missing SMTP env vars (need SMTP_HOST, SMTP_USER, SMTP_PASS).");
  console.error("  Run with:  node --env-file=.env scripts/verify-email.mjs <recipient>");
  process.exit(1);
}

// Implicit TLS on 465; STARTTLS on 587. SMTP_SECURE overrides if set.
const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

console.log(`→ Connecting to ${host}:${port} (secure=${secure}) as ${user}…`);
try {
  await transporter.verify();
  console.log("✓ SMTP connection + auth OK");
} catch (err) {
  console.error("✗ SMTP connect/auth failed:", err?.message ?? err);
  console.error("  Common causes: 2-Step Verification not enabled, wrong App Password,");
  console.error("  or the env var not loaded (use --env-file=.env).");
  process.exit(1);
}

console.log(`→ Sending test email  from "${from}"  to "${to}"…`);
try {
  const info = await transporter.sendMail({
    from,
    to,
    subject: "✅ GooglyWoogly email test",
    html: "<p>Test from <b>verify-email.mjs</b>. If you can read this, transactional email via Gmail SMTP is working. 🎉</p>",
  });
  console.log(`✓ Sent. messageId=${info.messageId}`);
  console.log("  Check the inbox (and Spam) for the test message.");
} catch (err) {
  console.error("✗ Send failed:", err?.message ?? err);
  process.exit(1);
}
