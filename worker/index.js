const MAX_BODY_BYTES = 16_384;
const MIN_FORM_AGE_MS = 2_500;
const MAX_FIELD_LENGTHS = {
  name: 120,
  organization: 160,
  email: 180,
  role: 80,
  interest: 120,
  message: 2_000,
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

function clean(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= MAX_FIELD_LENGTHS.email;
}

async function parseContactRequest(request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return { error: "Message is too large." };
  }

  let raw;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
      return { error: "Message is too large." };
    }
    raw = JSON.parse(body);
  } catch {
    return { error: "Please submit the form again." };
  }

  const payload = {
    name: clean(raw.name, MAX_FIELD_LENGTHS.name),
    organization: clean(raw.organization, MAX_FIELD_LENGTHS.organization),
    email: clean(raw.email, MAX_FIELD_LENGTHS.email),
    role: clean(raw.role, MAX_FIELD_LENGTHS.role),
    interest: clean(raw.interest, MAX_FIELD_LENGTHS.interest),
    message: clean(raw.message, MAX_FIELD_LENGTHS.message),
    website: clean(raw.website, 160),
    startedAt: Number(raw.startedAt || 0),
  };

  if (payload.website) {
    return { bot: true };
  }

  if (!payload.startedAt || Date.now() - payload.startedAt < MIN_FORM_AGE_MS) {
    return { bot: true };
  }

  if (!payload.name || !payload.organization || !isValidEmail(payload.email)) {
    return { error: "Please enter your name, organization, and a valid work email." };
  }

  return { payload };
}

function buildEmail(payload) {
  const lines = [
    `Name: ${payload.name}`,
    `Organization: ${payload.organization}`,
    `Email: ${payload.email}`,
    `Role: ${payload.role || "Not provided"}`,
    `Interest: ${payload.interest || "Not provided"}`,
    "",
    "Message:",
    payload.message || "No additional message provided.",
  ];

  const htmlRows = [
    ["Name", payload.name],
    ["Organization", payload.organization],
    ["Email", payload.email],
    ["Role", payload.role || "Not provided"],
    ["Interest", payload.interest || "Not provided"],
  ]
    .map(([label, value]) => (
      `<tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151">${escapeHtml(label)}</th><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827">${escapeHtml(value)}</td></tr>`
    ))
    .join("");

  return {
    subject: `Med-AI Clinical pilot inquiry: ${payload.organization}`,
    text: lines.join("\n"),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#111827">
        <h1 style="font-size:20px;margin:0 0 14px">New Med-AI Clinical pilot inquiry</h1>
        <table style="border-collapse:collapse;width:100%;max-width:680px;border:1px solid #e5e7eb">${htmlRows}</table>
        <h2 style="font-size:16px;margin:22px 0 8px">Message</h2>
        <p style="white-space:pre-wrap;margin:0;padding:14px;background:#f9fafb;border:1px solid #e5e7eb">${escapeHtml(payload.message || "No additional message provided.")}</p>
        <p style="margin-top:18px;color:#6b7280;font-size:12px">This message was submitted from medaiclinical.com/contact.html. Do not request or process patient data through this public form.</p>
      </div>
    `,
  };
}

async function sendWithWebhook(env, payload, email) {
  const rawUrl = clean(env.CONTACT_WEBHOOK_URL, 2_048);
  let webhookUrl;

  try {
    webhookUrl = new URL(rawUrl);
  } catch {
    throw new Error("CONTACT_WEBHOOK_URL is not a valid URL.");
  }

  if (webhookUrl.protocol !== "https:") {
    throw new Error("CONTACT_WEBHOOK_URL must use HTTPS.");
  }

  const response = await fetch(webhookUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Contact-Source": "medaiclinical.com",
    },
    body: JSON.stringify({
      secret: env.CONTACT_WEBHOOK_SECRET || undefined,
      source: "medaiclinical.com",
      submittedAt: new Date().toISOString(),
      subject: email.subject,
      text: email.text,
      contact: {
        name: payload.name,
        organization: payload.organization,
        email: payload.email,
        role: payload.role,
        interest: payload.interest,
        message: payload.message,
      },
    }),
  });

  let result = {};
  try {
    result = await response.clone().json();
  } catch {
    result = {};
  }

  if (!response.ok || result.ok === false) {
    throw new Error(result.message || `Webhook failed with status ${response.status}.`);
  }
}

async function sendWithCloudflareEmail(env, payload, email) {
  const to = env.CONTACT_TO || "hello@medaiclinical.com";
  const fromEmail = env.CONTACT_FROM || "hello@medaiclinical.com";
  const fromName = env.CONTACT_FROM_NAME || "Med-AI Clinical Website";

  await env.EMAIL.send({
    to,
    from: { email: fromEmail, name: fromName },
    replyTo: { email: payload.email, name: payload.name },
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

async function handleContact(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).hostname !== requestUrl.hostname) {
        return json({ ok: false, message: "Request origin is not allowed." }, 403);
      }
    } catch {
      return json({ ok: false, message: "Request origin is not allowed." }, 403);
    }
  }

  const parsed = await parseContactRequest(request);
  if (parsed.bot) {
    return json({ ok: true, message: "Thanks. We received your request." });
  }
  if (parsed.error) {
    return json({ ok: false, message: parsed.error }, 400);
  }

  const email = buildEmail(parsed.payload);

  if (!env.CONTACT_WEBHOOK_URL && !env.EMAIL?.send) {
    return json({ ok: false, message: "Contact email is not configured yet." }, 503);
  }

  try {
    if (env.CONTACT_WEBHOOK_URL) {
      await sendWithWebhook(env, parsed.payload, email);
    } else {
      await sendWithCloudflareEmail(env, parsed.payload, email);
    }
  } catch (error) {
    console.error("Contact delivery failed", {
      code: error?.code,
      message: error?.message,
    });
    return json({ ok: false, message: "We could not send the message right now. Please email hello@medaiclinical.com directly." }, 502);
  }

  return json({ ok: true, message: "Thanks. We received your request and will reply by email." });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact") {
      return handleContact(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
