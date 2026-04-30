/**
 * Email dispatch service.
 * Uses Resend in production, logs to console in development.
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  plain: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || "onboarding@chiefaiofficer.com";
  const fromName = process.env.EMAIL_FROM_NAME || "CAIO Onboarding";

  if (!apiKey || apiKey === "re_your_api_key") {
    // Development mode: log instead of sending
    console.log("[EMAIL] Would send email:");
    console.log(`  To: ${params.to}`);
    console.log(`  Subject: ${params.subject}`);
    console.log(`  Body length: ${params.html.length} chars`);
    return { success: true, messageId: `dev_${Date.now()}` };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.plain,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Resend API error: ${response.status} ${error}` };
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (error) {
    return {
      success: false,
      error: `Email send failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
