const CONTACT_RECIPIENT = "hello@medaiclinical.com";
const WEBHOOK_SECRET = "replace-with-the-same-secret-you-store-in-cloudflare";

function doPost(event) {
  try {
    const data = JSON.parse(event.postData.contents || "{}");

    if (!WEBHOOK_SECRET || WEBHOOK_SECRET.indexOf("replace-with") === 0) {
      throw new Error("Set WEBHOOK_SECRET before deploying this script.");
    }

    if (data.secret !== WEBHOOK_SECRET) {
      return json({ ok: false, message: "Unauthorized." });
    }

    const contact = normalizeContact(data.contact || {});
    if (!contact.name || !contact.organization || !isEmail(contact.email)) {
      return json({ ok: false, message: "Invalid contact payload." });
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      return json({ ok: false, message: "Daily email quota is exhausted." });
    }

    const subject = cleanText(
      data.subject || "Med-AI Clinical pilot inquiry: " + contact.organization,
      180
    );
    const body = buildText(contact, data.submittedAt);
    const message = {
      to: CONTACT_RECIPIENT,
      subject: subject,
      body: body,
      htmlBody: buildHtml(contact, data.submittedAt),
      name: "Med-AI Clinical Website",
      replyTo: contact.email,
    };

    MailApp.sendEmail(message);
    return json({ ok: true });
  } catch (error) {
    console.error("Contact email failed", error && error.message);
    return json({ ok: false, message: "Could not send contact email." });
  }
}

function normalizeContact(contact) {
  return {
    name: cleanText(contact.name, 120),
    organization: cleanText(contact.organization, 160),
    email: cleanText(contact.email, 180),
    role: cleanText(contact.role || "Not provided", 80),
    interest: cleanText(contact.interest || "Not provided", 120),
    message: cleanText(contact.message || "No additional message provided.", 2000),
  };
}

function buildText(contact, submittedAt) {
  return [
    "Name: " + contact.name,
    "Organization: " + contact.organization,
    "Email: " + contact.email,
    "Role: " + contact.role,
    "Interest: " + contact.interest,
    "Submitted at: " + cleanText(submittedAt || "", 80),
    "",
    "Message:",
    contact.message,
    "",
    "Do not request or process patient data through this public form.",
  ].join("\n");
}

function buildHtml(contact, submittedAt) {
  const rows = [
    ["Name", contact.name],
    ["Organization", contact.organization],
    ["Email", contact.email],
    ["Role", contact.role],
    ["Interest", contact.interest],
    ["Submitted at", cleanText(submittedAt || "", 80)],
  ].map(function(row) {
    return "<tr><th align=\"left\" style=\"padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151\">" +
      escapeHtml(row[0]) +
      "</th><td style=\"padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827\">" +
      escapeHtml(row[1]) +
      "</td></tr>";
  }).join("");

  return "<div style=\"font-family:Arial,sans-serif;line-height:1.55;color:#111827\">" +
    "<h1 style=\"font-size:20px;margin:0 0 14px\">New Med-AI Clinical pilot inquiry</h1>" +
    "<table style=\"border-collapse:collapse;width:100%;max-width:680px;border:1px solid #e5e7eb\">" +
    rows +
    "</table>" +
    "<h2 style=\"font-size:16px;margin:22px 0 8px\">Message</h2>" +
    "<p style=\"white-space:pre-wrap;margin:0;padding:14px;background:#f9fafb;border:1px solid #e5e7eb\">" +
    escapeHtml(contact.message) +
    "</p>" +
    "<p style=\"margin-top:18px;color:#6b7280;font-size:12px\">Do not request or process patient data through this public form.</p>" +
    "</div>";
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
