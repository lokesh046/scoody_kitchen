import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_magic_link_email(
    to_email: str,
    raw_token: str,
    otp_code: str,
) -> bool:
    frontend_base = settings.FRONTEND_URL.rstrip("/")
    magic_link_url = f"{frontend_base}/auth/magic-link/verify?token={raw_token}"

    subject = "Your ScoobyPets Login Magic Link"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px; color: #333;">
        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            <h2 style="color: #4F46E5; margin-top: 0;">ScoobyPets Passwordless Login</h2>
            <p>Hello,</p>
            <p>Click the button below to log in to your ScoobyPets account instantly. This link is valid for 10 minutes and can only be used once.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{magic_link_url}" style="background-color: #4F46E5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Log In to ScoobyPets</a>
            </div>

            <p style="text-align: center; color: #666; margin-top: 20px;">Or enter this 6-digit login code manually:</p>
            <div style="text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #111827; background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 10px 0;">
                {otp_code}
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
            <p style="font-size: 12px; color: #888;">If you did not request this link, you can safely ignore this email.</p>
        </div>
    </body>
    </html>
    """

    # Always log magic link URL and OTP code to server console for easy dev testing
    logger.info("==================================================")
    logger.info(f"MAGIC LINK GENERATED FOR: {to_email}")
    logger.info(f"MAGIC LINK URL: {magic_link_url}")
    logger.info(f"6-DIGIT OTP CODE: {otp_code}")
    logger.info("==================================================")

    # If SMTP is not fully configured, return success via console log fallback
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP settings not configured. Magic link logged to console above.")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.EMAILS_FROM or settings.SMTP_USER
        msg["To"] = to_email

        msg.attach(MIMEText(f"Your Magic Link: {magic_link_url}\nOTP Code: {otp_code}", "plain"))
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Magic link email successfully sent to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {to_email} via SMTP: {exc}")
        return False
