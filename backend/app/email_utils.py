"""
SMTP email delivery for the account lifecycle: email verification and
password reset. Kept as its own module (same "one file, one
responsibility" convention as security.py) so routers/auth.py doesn't
need to know anything about SMTP itself -- it just calls
`send_verification_email` / `send_password_reset_email`.

Configuration is entirely environment-variable driven (see
backend/.env.example), same convention as AUTH_SECRET_KEY in
security.py. If SMTP_HOST/SMTP_FROM_EMAIL aren't set, `smtp_configured()`
returns False and callers fall back to the existing dev-mode behavior
(returning the raw token in the response) instead of raising -- so this
app still boots and works locally with zero mail setup, exactly like
before this module existed.

Works with any standard SMTP provider: Gmail (smtp.gmail.com:587 with
an App Password -- a normal Gmail password will be rejected), SendGrid,
Mailgun, Amazon SES, Postmark, or a local dev catcher like
MailHog/Mailtrap (SMTP_ENCRYPTION=none).
"""
import os
import smtplib
import ssl
from email.message import EmailMessage

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", "")
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "Productivity Dashboard")
# "starttls" (default, port 587) upgrades a plaintext connection; "ssl"
# (typically port 465) connects TLS-wrapped from the start; "none" is
# for local dev catchers (e.g. MailHog) that don't speak TLS at all.
SMTP_ENCRYPTION = os.environ.get("SMTP_ENCRYPTION", "starttls").lower()

# Used to build the links inside the emails (e.g. /verify-email?token=...)
# -- this is the *frontend's* origin, not the API's.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def smtp_configured() -> bool:
    """True once enough SMTP settings are present to actually attempt a
    send. `SMTP_HOST` + `SMTP_FROM_EMAIL` are the minimum -- some local
    dev catchers (MailHog) accept unauthenticated connections, so
    username/password aren't required here."""
    return bool(SMTP_HOST and SMTP_FROM_EMAIL)


def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """Sends one email. Returns False (never raises) on any failure --
    callers treat a failed send the same way they already treat "no
    mail sender configured" (fall back to the debug-token response)
    rather than turning a registration/login flow into a 500 because an
    SMTP provider had a bad moment."""
    if not smtp_configured():
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    try:
        if SMTP_ENCRYPTION == "ssl":
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=10) as server:
                if SMTP_USERNAME:
                    server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                if SMTP_ENCRYPTION == "starttls":
                    server.starttls(context=ssl.create_default_context())
                if SMTP_USERNAME:
                    server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.send_message(msg)
        return True
    except Exception as exc:  # noqa: BLE001 -- any SMTP/network failure just degrades to "not sent"
        print(f"[email_utils] Failed to send email to {to_email}: {exc}")
        return False


def _wrap_html(title: str, body_html: str, button_label: str, button_url: str) -> str:
    """Shared minimal HTML shell so verification/reset emails look like
    they belong to the same app, without pulling in a template-engine
    dependency for two short emails."""
    return f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#0B0E1A;font-family:Inter,Arial,sans-serif;color:#E5E7F0;">
    <div style="max-width:480px;margin:0 auto;background:#12162A;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#fff;">{title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#B4B8CC;">{body_html}</div>
      <a href="{button_url}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#7C5CFC;color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">{button_label}</a>
      <p style="margin-top:24px;font-size:12px;color:#6B7086;word-break:break-all;">If the button doesn't work, copy this link into your browser:<br>{button_url}</p>
    </div>
  </body>
</html>"""


def send_verification_email(to_email: str, display_name: str, token: str) -> bool:
    link = f"{FRONTEND_URL}/verify-email?token={token}"
    html = _wrap_html(
        "Verify your email",
        f"Hi {display_name or to_email},<br><br>Confirm this is your email address to finish "
        f"setting up your Productivity Dashboard account. This link expires in 24 hours.",
        "Verify email",
        link,
    )
    text = f"Hi {display_name or to_email},\n\nVerify your email address: {link}\n\nThis link expires in 24 hours."
    return send_email(to_email, "Verify your email address", html, text)


def send_password_reset_email(to_email: str, display_name: str, token: str) -> bool:
    link = f"{FRONTEND_URL}/reset-password?token={token}"
    html = _wrap_html(
        "Reset your password",
        f"Hi {display_name or to_email},<br><br>We received a request to reset your password. "
        f"This link expires in 60 minutes. If you didn't request this, you can safely ignore this email.",
        "Reset password",
        link,
    )
    text = (
        f"Hi {display_name or to_email},\n\nReset your password: {link}\n\n"
        f"This link expires in 60 minutes. If you didn't request this, ignore this email."
    )
    return send_email(to_email, "Reset your password", html, text)
