// =============================================================
// Member invite email template
// =============================================================
// Sent by Resend when an admin invites a new team member from the
// Members tab. The email contains a magic link to /welcome?token=...
// where the member can set up a password (optional) and sign in.
// =============================================================

interface InviteEmailParams {
  inviteeName: string;
  inviteeEmail: string;
  inviterName: string;
  role: "admin" | "user";
  department: string;
  welcomeUrl: string;
}

export function buildInviteEmail(params: InviteEmailParams) {
  const { inviteeName, inviterName, role, department, welcomeUrl } = params;
  const roleLabel = role === "admin" ? "Admin" : "User";
  const subject = `${inviterName} invited you to Motherboard`;

  // Absolute URL for the CAIO logo (white on transparent — works on purple banner)
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://motherboard.chiefaiofficer.com"
  ).replace(/\/$/, "");
  const caioLogoUrl = `${appUrl}/caio-logo-white.png`;
  const motherboardLogoUrl = `${appUrl}/icon-dark.png`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif; color:#18181b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5; padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px; background:#ffffff; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.04); overflow:hidden;">
          <!-- Brand bar with CAIO logo -->
          <tr>
            <td style="background:#6749e3; padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:middle; padding-right:10px;">
                          <img src="${motherboardLogoUrl}" alt="Motherboard" width="28" height="28" style="display:block; border:0; outline:none;">
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="color:#ffffff; font-size:15px; font-weight:600; letter-spacing:-0.01em; line-height:1.2;">Motherboard</div>
                          <div style="color:rgba(255,255,255,0.75); font-size:12px; margin-top:2px; line-height:1.2;">CAIO Internal Operations</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align:middle; text-align:right;">
                    <img src="${caioLogoUrl}" alt="Chief AI Officer" width="44" height="44" style="display:block; margin-left:auto; border:0; outline:none; opacity:0.95;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px; font-size:22px; font-weight:600; color:#18181b; letter-spacing:-0.02em;">
                You're invited, ${escapeHtml(inviteeName)} 👋
              </h1>
              <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#3f3f46;">
                <strong>${escapeHtml(inviterName)}</strong> has added you to the
                <strong>Motherboard</strong> internal operations platform — your home
                for onboarding, access management, and prospect research at CAIO.
              </p>

              <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0; width:100%; background:#fafafa; border-radius:8px;">
                <tr>
                  <td style="padding:14px 18px; font-size:13px; color:#52525b;">
                    <div style="margin-bottom:6px;"><strong style="color:#18181b;">Role:</strong> ${roleLabel}</div>
                    <div><strong style="color:#18181b;">Department:</strong> ${escapeHtml(department)}</div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3f3f46;">
                Click below to activate your account. You can sign in with your
                Google work account, or set up a password — your choice.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#18181b; border-radius:8px;">
                    <a href="${welcomeUrl}" style="display:inline-block; padding:13px 28px; color:#ffffff; font-size:15px; font-weight:500; text-decoration:none; letter-spacing:-0.01em;">
                      Activate your account →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px; font-size:13px; color:#71717a; line-height:1.6;">
                This invite link is valid for 7 days. If you weren't expecting this,
                you can ignore the email — nothing will happen.
              </p>
              <p style="margin:0; font-size:12px; color:#a1a1aa; line-height:1.6; word-break:break-all;">
                Or copy this URL into your browser:<br>
                <a href="${welcomeUrl}" style="color:#6749e3; text-decoration:none;">${welcomeUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; border-top:1px solid #f4f4f5; font-size:12px; color:#a1a1aa;">
              Motherboard · CAIO Internal Tools<br>
              You received this because an admin invited you to join the workspace.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const plain = `You're invited, ${inviteeName}!

${inviterName} has added you to Motherboard — CAIO's internal operations platform.

Role: ${roleLabel}
Department: ${department}

Activate your account here:
${welcomeUrl}

You can sign in with your Google work account, or set up a password — your choice.

This link is valid for 7 days. If you weren't expecting this, ignore the email.

— Motherboard
`;

  return { subject, html, plain };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
