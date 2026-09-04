import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_base_email_template(title: str, content_html: str) -> str:
    """
    Renders the unified artisanal Scooby's Kitchen email layout.
    Features the mascot logo in a warm porcelain seal medallion.
    """
    frontend_base = settings.FRONTEND_URL.rstrip("/")
    logo_url = f"{frontend_base}/scooby-logo.png"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9F6F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #362820; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F9F6F0; padding: 30px 10px;">
        <tr>
            <td align="center">
                <!-- Main Container Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #FFFFFF; border: 1.5px solid #EBE0D0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(54, 40, 32, 0.06);">
                    
                    <!-- Header Section with Mascot Logo -->
                    <tr>
                        <td align="center" style="background-color: #362820; padding: 28px 20px; text-align: center;">
                            <!-- Porcelain Logo Medallion -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                                <tr>
                                    <td align="center" style="width: 64px; height: 64px; background-color: #FAF6EC; border: 1.5px solid #D09E6B; border-radius: 50%; padding: 4px;">
                                        <img src="{logo_url}" alt="Scooby's Kitchen Logo" width="56" height="56" style="display: block; width: 56px; height: 56px; object-fit: contain; margin: 0 auto; border: 0;" />
                                    </td>
                                </tr>
                            </table>
                            <h1 style="color: #FFFFFF; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; margin: 12px 0 2px 0; text-transform: uppercase;">
                                Scooby's Kitchen
                            </h1>
                            <p style="color: #D09E6B; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; margin: 0; text-transform: uppercase; font-family: monospace;">
                                Honest Small-Batch Pet Cooking
                            </p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 32px 28px;">
                            {content_html}
                        </td>
                    </tr>

                    <!-- Footer Section -->
                    <tr>
                        <td style="background-color: #FAF6EC; border-top: 1px dashed #EBE0D0; padding: 20px 24px; text-align: center;">
                            <p style="font-size: 11px; color: #362820; opacity: 0.8; margin: 0 0 6px 0; font-weight: 600;">
                                Veterinary-Supervised Formulations • Zero Starch Fillers
                            </p>
                            <p style="font-size: 10px; color: #888888; margin: 0; font-family: monospace;">
                                © Scooby's Kitchen. All rights reserved.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""


def send_magic_link_email(
    to_email: str,
    raw_token: str,
    otp_code: str,
) -> bool:
    frontend_base = settings.FRONTEND_URL.rstrip("/")
    magic_link_url = f"{frontend_base}/auth/magic-link/verify?token={raw_token}"

    subject = f"🐾 {otp_code} is your Scooby's Kitchen Login OTP & Link"
    
    content = f"""
        <h2 style="color: #362820; font-size: 18px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: -0.3px;">
            Passwordless Security Login
        </h2>
        <p style="font-size: 13px; line-height: 1.6; color: #4A3B32; margin: 0 0 20px 0;">
            Hello, click the button below to instantly sign in to your Scooby's Kitchen account. This link is valid for 10 minutes.
        </p>
        
        <!-- Action Button -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
            <tr>
                <td align="center">
                    <a href="{magic_link_url}" style="background-color: #D09E6B; color: #362820; font-size: 13px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 6px rgba(208, 158, 107, 0.4);">
                        Log In to Scooby's Kitchen
                    </a>
                </td>
            </tr>
        </table>

        <div style="border-top: 1px dashed #EBE0D0; margin: 24px 0 18px 0;"></div>

        <p style="text-align: center; font-size: 11px; font-weight: 700; color: #362820; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-family: monospace;">
            Or Enter This 6-Digit Code Manually:
        </p>
        <div style="text-align: center; font-size: 30px; font-weight: 900; letter-spacing: 6px; color: #362820; background-color: #FAF6EC; border: 1.5px dashed #D09E6B; padding: 14px; border-radius: 8px; margin: 0 auto 20px auto; font-family: monospace; max-width: 220px;">
            {otp_code}
        </div>

        <p style="font-size: 11px; color: #888888; line-height: 1.5; margin: 0; text-align: center;">
            If you did not request this login code, you can safely ignore this email.
        </p>
    """

    html_content = _get_base_email_template("Scooby's Kitchen Login", content)

    # Always log magic link URL and OTP code to server console for dev testing
    logger.info("==================================================")
    logger.info(f"MAGIC LINK GENERATED FOR: {to_email}")
    logger.info(f"MAGIC LINK URL: {magic_link_url}")
    logger.info(f"6-DIGIT OTP CODE: {otp_code}")
    logger.info("==================================================")

    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP settings not configured. Magic link logged to console above.")
        return True

    try:
        sender_email = settings.EMAILS_FROM or settings.SMTP_USER
        from_header = f"Scooby's Kitchen <{sender_email}>" if "<" not in (sender_email or "") else sender_email

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_header
        msg["To"] = to_email
        msg["Reply-To"] = sender_email

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


def send_doctor_verification_email(
    to_email: str,
    first_name: str,
) -> bool:
    subject = "🐾 Your Scooby's Kitchen Veterinary Account is Verified!"
    dashboard_url = f"{settings.FRONTEND_URL.rstrip('/')}/doctor/dashboard"

    content = f"""
        <h2 style="color: #3F5E4D; font-size: 18px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase;">
            Congratulations, Dr. {first_name}!
        </h2>
        <p style="font-size: 13px; line-height: 1.6; color: #4A3B32; margin: 0 0 16px 0;">
            We are pleased to inform you that your professional veterinary credentials have been verified by our clinical audit team.
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #4A3B32; margin: 0 0 24px 0;">
            Your profile has been upgraded to a certified <strong>Doctor Account</strong>. You can now access your doctor portal to manage schedule slots, conduct live video consultations, and audit custom pet nutrition diets.
        </p>
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
            <tr>
                <td align="center">
                    <a href="{dashboard_url}" style="background-color: #3F5E4D; color: #FFFFFF; font-size: 13px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px;">
                        Open Doctor Dashboard
                    </a>
                </td>
            </tr>
        </table>
    """

    html_content = _get_base_email_template("Doctor Account Verified", content)

    logger.info("==================================================")
    logger.info(f"DOCTOR VERIFICATION EMAIL TO: {to_email}")
    logger.info(f"VERIFIED DOCTOR NAME: Dr. {first_name}")
    logger.info("==================================================")

    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP settings not configured. Verification email logged to console above.")
        return True

    try:
        sender_email = settings.EMAILS_FROM or settings.SMTP_USER
        from_header = f"Scooby's Kitchen <{sender_email}>" if "<" not in (sender_email or "") else sender_email

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_header
        msg["To"] = to_email
        msg["Reply-To"] = sender_email

        msg.attach(MIMEText(f"Congratulations Dr. {first_name}! Your account has been verified and upgraded to a Doctor profile.", "plain"))
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Doctor verification email sent to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {to_email} via SMTP: {exc}")
        return False


def send_order_update_email(
    to_email: str,
    first_name: str | None,
    title: str,
    message: str,
) -> bool:
    subject = f"🐾 Scooby's Kitchen: {title}"
    orders_url = f"{settings.FRONTEND_URL.rstrip('/')}/orders"

    content = f"""
        <h2 style="color: #362820; font-size: 18px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase;">
            Order Status Update 📦
        </h2>
        <p style="font-size: 13px; line-height: 1.6; color: #4A3B32; margin: 0 0 16px 0;">
            Hello {first_name or 'there'}, we have an operational update regarding your small-batch pet food order:
        </p>
        
        <div style="background-color: #FAF6EC; padding: 18px; border-left: 4px solid #D09E6B; border-radius: 6px; margin: 20px 0; font-weight: 600; font-size: 13px; color: #362820; line-height: 1.5;">
            {message}
        </div>

        <p style="font-size: 12px; color: #4A3B32; margin: 0 0 24px 0;">
            You can view live delivery milestones, shipment tracking, and batch recipe decision ledgers directly from your account.
        </p>
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
            <tr>
                <td align="center">
                    <a href="{orders_url}" style="background-color: #D09E6B; color: #362820; font-size: 13px; font-weight: 800; text-decoration: none; padding: 12px 26px; border-radius: 8px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px;">
                        View My Orders
                    </a>
                </td>
            </tr>
        </table>
    """

    html_content = _get_base_email_template(f"Scooby's Kitchen: {title}", content)

    logger.info("==================================================")
    logger.info(f"ORDER UPDATE EMAIL TO: {to_email}")
    logger.info(f"SUBJECT: {subject}")
    logger.info(f"MESSAGE: {message}")
    logger.info("==================================================")

    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP settings not configured. Order update email logged to console above.")
        return True

    try:
        sender_email = settings.EMAILS_FROM or settings.SMTP_USER
        from_header = f"Scooby's Kitchen <{sender_email}>" if "<" not in (sender_email or "") else sender_email

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_header
        msg["To"] = to_email
        msg["Reply-To"] = sender_email

        msg.attach(MIMEText(message, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Order update email sent to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {to_email} via SMTP: {exc}")
        return False


def send_consultation_invoice_email(
    to_email: str,
    customer_name: str | None,
    doctor_name: str,
    specialization: str,
    pet_name: str,
    scheduled_at_str: str,
    amount_paid: float,
    payment_id: str,
    consultation_id: int,
    meeting_link: str | None = None,
) -> bool:
    subject = f"🧾 Scooby's Kitchen: Consultation Invoice & Appointment Receipt (#{consultation_id})"
    consultations_url = meeting_link or f"{settings.FRONTEND_URL.rstrip('/')}/consultations"

    content = f"""
        <h2 style="color: #362820; font-size: 18px; font-weight: 800; margin: 0 0 8px 0; text-transform: uppercase;">
            Consultation Booking Invoice
        </h2>
        <p style="font-size: 11px; font-family: monospace; color: #888888; margin: 0 0 18px 0; text-transform: uppercase;">
            Invoice & Receipt Ref: #{consultation_id} • Status: PAID
        </p>

        <p style="font-size: 13px; line-height: 1.6; color: #4A3B32; margin: 0 0 16px 0;">
            Hello {customer_name or 'there'}, your veterinary consultation for <strong>🐾 {pet_name}</strong> has been confirmed and paid. Here is your itemized receipt and appointment file:
        </p>

        <!-- Itemized Receipt Ledger Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FAF6EC; border: 1.5px solid #EBE0D0; border-radius: 8px; margin: 16px 0; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <tr>
                <td style="padding: 12px 16px; border-bottom: 1px dashed #EBE0D0; color: #888888; font-family: monospace; font-size: 10px; text-transform: uppercase; font-weight: 700;">Specialist Doctor</td>
                <td style="padding: 12px 16px; border-bottom: 1px dashed #EBE0D0; text-align: right; font-weight: 700; color: #362820;">Dr. {doctor_name} <span style="font-size: 10px; color: #3F5E4D; font-weight: normal;">({specialization})</span></td>
            </tr>
            <tr>
                <td style="padding: 12px 16px; border-bottom: 1px dashed #EBE0D0; color: #888888; font-family: monospace; font-size: 10px; text-transform: uppercase; font-weight: 700;">Companion Patient</td>
                <td style="padding: 12px 16px; border-bottom: 1px dashed #EBE0D0; text-align: right; font-weight: 700; color: #362820;">🐾 {pet_name}</td>
            </tr>
            <tr>
                <td style="padding: 12px 16px; border-bottom: 1px dashed #EBE0D0; color: #888888; font-family: monospace; font-size: 10px; text-transform: uppercase; font-weight: 700;">Scheduled Time</td>
                <td style="padding: 12px 16px; border-bottom: 1px dashed #EBE0D0; text-align: right; font-weight: 700; color: #362820;">{scheduled_at_str}</td>
            </tr>
            <tr>
                <td style="padding: 12px 16px; border-bottom: 1px dashed #EBE0D0; color: #888888; font-family: monospace; font-size: 10px; text-transform: uppercase; font-weight: 700;">Transaction ID</td>
                <td style="padding: 12px 16px; border-bottom: 1px dashed #EBE0D0; text-align: right; font-family: monospace; font-size: 11px; color: #362820;">{payment_id}</td>
            </tr>
            <tr style="background-color: #F4EAD8;">
                <td style="padding: 14px 16px; font-weight: 900; color: #362820; text-transform: uppercase; font-size: 11px;">Total Amount Paid</td>
                <td style="padding: 14px 16px; text-align: right; font-weight: 900; color: #3F5E4D; font-size: 15px; font-family: monospace;">₹{amount_paid:.2f}</td>
            </tr>
        </table>

        <p style="font-size: 12px; line-height: 1.5; color: #4A3B32; margin: 16px 0;">
            Please ensure your companion is in a quiet, well-lit area 5 minutes before your scheduled appointment. You can join the encrypted live video call directly from the button below:
        </p>

        <!-- Action Button -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
            <tr>
                <td align="center">
                    <a href="{consultations_url}" style="background-color: #3F5E4D; color: #FFFFFF; font-size: 13px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 6px rgba(63, 94, 77, 0.3);">
                        Open Consultation & Video Room
                    </a>
                </td>
            </tr>
        </table>
    """

    html_content = _get_base_email_template("Consultation Invoice & Receipt", content)

    logger.info("==================================================")
    logger.info(f"CONSULTATION INVOICE EMAIL TO: {to_email}")
    logger.info(f"CONSULTATION ID: #{consultation_id}")
    logger.info(f"DOCTOR: Dr. {doctor_name} | AMOUNT: ₹{amount_paid:.2f}")
    logger.info(f"TRANSACTION ID: {payment_id}")
    logger.info("==================================================")

    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP settings not configured. Consultation invoice logged to console above.")
        return True

    try:
        sender_email = settings.EMAILS_FROM or settings.SMTP_USER
        from_header = f"Scooby's Kitchen <{sender_email}>" if "<" not in (sender_email or "") else sender_email

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_header
        msg["To"] = to_email
        msg["Reply-To"] = sender_email

        msg.attach(MIMEText(f"Consultation Booking #{consultation_id} Confirmed.\nDoctor: Dr. {doctor_name}\nPatient: {pet_name}\nAmount: ₹{amount_paid:.2f}\nTransaction: {payment_id}", "plain"))
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Consultation invoice email sent to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send consultation invoice to {to_email}: {exc}")
        return False
