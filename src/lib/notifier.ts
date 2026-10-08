const DEFAULT_FROM = "noreply@tomas-tello.stream";

async function sendEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL_TO;
  if (!apiKey || !to) return;

  const from = process.env.NOTIFY_EMAIL_FROM ?? DEFAULT_FROM;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
  } catch {
    // Never throw — fire and forget
  }
}

export async function notifySystemLocked({
  bytesIn24h,
  lastUserEmail,
}: {
  bytesIn24h: number;
  lastUserEmail?: string;
}): Promise<void> {
  const mb = (bytesIn24h / (1024 * 1024)).toFixed(1);
  await sendEmail(
    "[tomas-tello.stream] System upload lock engaged",
    `<p>The system upload lock has been engaged.</p>
     <p><strong>Bytes transferred (24h):</strong> ${mb} MB</p>
     ${lastUserEmail ? `<p><strong>Last uploader:</strong> ${lastUserEmail}</p>` : ""}
     <p>Use the admin security panel to unlock.</p>`
  );
}

export async function notifyRateLimitAbuse({
  ip,
  userEmail,
  hitCount,
}: {
  ip: string;
  userEmail: string;
  hitCount: number;
}): Promise<void> {
  await sendEmail(
    "[tomas-tello.stream] Rate limit abuse detected",
    `<p>Repeated rate limit violations detected.</p>
     <p><strong>IP:</strong> ${ip}</p>
     <p><strong>User:</strong> ${userEmail}</p>
     <p><strong>Hit count (10 min):</strong> ${hitCount}</p>`
  );
}

export async function notifyServerError({
  error,
  context,
}: {
  error: string;
  context: string;
}): Promise<void> {
  await sendEmail(
    "[tomas-tello.stream] Server error",
    `<p>An unhandled server error occurred.</p>
     <p><strong>Context:</strong> ${context}</p>
     <p><strong>Error:</strong> ${error}</p>`
  );
}
