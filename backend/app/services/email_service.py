"""
Email Service for sending OTP verification codes
"""
import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Dict, Optional
import os

from core.redis_client import redis_client

class EmailService:
    """Service for sending OTP emails"""

    def __init__(self):
        # Email configuration - use environment variables
        self.smtp_server = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.sender_email = os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", "noreply@vaultx.com"))
        self.sender_password = os.getenv("SMTP_PASSWORD", "")

    def generate_otp(self, length: int = 6) -> str:
        """Generate a random OTP code"""
        return ''.join(random.choices(string.digits, k=length))

    def store_otp(self, email: str, otp: str, expires_in_minutes: int = 10):
        """Store OTP with expiration time (backed by Redis, survives restarts)."""
        redis_client.store_otp(email, otp, expires_in_seconds=expires_in_minutes * 60)

    def verify_otp(self, email: str, otp: str) -> tuple[bool, str]:
        """
        Verify OTP code
        Returns (is_valid, message)
        """
        return redis_client.verify_otp(email, otp)
    
    def send_otp_email(self, recipient_email: str, otp: str) -> bool:
        """
        Send OTP via email
        """
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = "VaultX - Your Verification Code"
            message["From"] = self.sender_email
            message["To"] = recipient_email
            
            # Email body
            text_content = f"""
            Welcome to VaultX!
            
            Your verification code is: {otp}
            
            This code will expire in 10 minutes.
            
            If you didn't request this code, please ignore this email.
            
            Best regards,
            VaultX Team
            """
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }}
                    .container {{ background-color: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                    .header {{ text-align: center; margin-bottom: 30px; }}
                    .logo {{ font-size: 32px; font-weight: bold; background: linear-gradient(135deg, #8B5CF6, #06B6D4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
                    .otp-box {{ background: linear-gradient(135deg, #8B5CF6, #06B6D4); color: white; font-size: 36px; font-weight: bold; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; letter-spacing: 8px; }}
                    .content {{ color: #333; line-height: 1.6; }}
                    .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px; }}
                    .warning {{ background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">VaultX</div>
                        <p style="color: #666; margin-top: 10px;">Professional Crypto Portfolio Tracker</p>
                    </div>
                    
                    <div class="content">
                        <h2 style="color: #8B5CF6;">Welcome to VaultX!</h2>
                        <p>Thank you for choosing VaultX to manage your cryptocurrency portfolio.</p>
                        <p>To complete your registration, please use the verification code below:</p>
                        
                        <div class="otp-box">{otp}</div>
                        
                        <p><strong>This code will expire in 10 minutes.</strong></p>
                        
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong> If you didn't request this code, please ignore this email and your account will remain secure.
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>© 2026 VaultX. All rights reserved.</p>
                        <p>This is an automated email, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Attach both versions
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)
            
            # Send email
            if self.sender_password:  # Only send if password is configured
                smtp_username = os.getenv("SMTP_USERNAME", self.sender_email)
                with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                    server.starttls()
                    server.login(smtp_username, self.sender_password)
                    server.send_message(message)
                print(f"✅ Email sent successfully to {recipient_email}")
                return True
            else:
                # Development mode - print OTP to console
                print(f"\n{'='*50}")
                print(f"📧 [DEV MODE] OTP Email for {recipient_email}")
                print(f"{'='*50}")
                print(f"OTP Code: {otp}")
                print(f"Expires: 10 minutes")
                print(f"{'='*50}\n")
                return True
                
        except Exception as e:
            print(f"Error sending email: {str(e)}")
            # In development, print OTP anyway
            print(f"\n{'='*50}")
            print(f"📧 [DEV MODE - EMAIL FAILED] OTP for {recipient_email}")
            print(f"{'='*50}")
            print(f"OTP Code: {otp}")
            print(f"{'='*50}\n")
            return True  # Return True in dev mode so registration can continue
    
    def send_password_reset_email(self, recipient_email: str, reset_token: str, reset_url: str) -> bool:
        """
        Send password reset email with reset link
        """
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = "VaultX - Password Reset Request"
            message["From"] = self.sender_email
            message["To"] = recipient_email
            
            # Full reset link
            full_reset_url = f"{reset_url}?token={reset_token}"
            
            # Email body
            text_content = f"""
            Password Reset Request
            
            We received a request to reset your VaultX password.
            
            To reset your password, click the link below:
            {full_reset_url}
            
            This link will expire in 1 hour.
            
            If you didn't request this password reset, please ignore this email.
            Your password will remain unchanged.
            
            Best regards,
            VaultX Team
            """
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }}
                    .container {{ background-color: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                    .header {{ text-align: center; margin-bottom: 30px; }}
                    .logo {{ font-size: 32px; font-weight: bold; background: linear-gradient(135deg, #8B5CF6, #06B6D4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
                    .content {{ color: #333; line-height: 1.6; }}
                    .button {{ display: inline-block; background: linear-gradient(135deg, #8B5CF6, #06B6D4); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }}
                    .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px; }}
                    .warning {{ background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }}
                    .expiry {{ color: #EF4444; font-weight: bold; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">VaultX</div>
                        <p style="color: #666; margin-top: 10px;">Professional Crypto Portfolio Tracker</p>
                    </div>
                    
                    <div class="content">
                        <h2 style="color: #8B5CF6;">Password Reset Request</h2>
                        <p>We received a request to reset your VaultX account password.</p>
                        <p>Click the button below to reset your password:</p>
                        
                        <div style="text-align: center;">
                            <a href="{full_reset_url}" class="button">Reset Password</a>
                        </div>
                        
                        <p class="expiry">⏰ This link will expire in 1 hour.</p>
                        
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged and your account will stay secure.
                        </div>
                        
                        <p style="color: #666; font-size: 12px; margin-top: 20px;">
                            If the button doesn't work, copy and paste this link into your browser:<br>
                            <a href="{full_reset_url}" style="color: #8B5CF6; word-break: break-all;">{full_reset_url}</a>
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p>© 2026 VaultX. All rights reserved.</p>
                        <p>This is an automated email, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Attach both versions
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)
            
            # Send email
            if self.sender_password:  # Only send if password is configured
                smtp_username = os.getenv("SMTP_USERNAME", self.sender_email)
                with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                    server.starttls()
                    server.login(smtp_username, self.sender_password)
                    server.send_message(message)
                print(f"✅ Password reset email sent successfully to {recipient_email}")
                return True
            else:
                # Development mode - print link to console
                print(f"\n{'='*50}")
                print(f"📧 [DEV MODE] Password Reset Email for {recipient_email}")
                print(f"{'='*50}")
                print(f"Reset Link: {full_reset_url}")
                print(f"Expires: 1 hour")
                print(f"{'='*50}\n")
                return True
                
        except Exception as e:
            print(f"Error sending password reset email: {str(e)}")
            # In development, print link anyway
            print(f"\n{'='*50}")
            print(f"📧 [DEV MODE - EMAIL FAILED] Password Reset for {recipient_email}")
            print(f"{'='*50}")
            print(f"Reset Link: {full_reset_url}")
            print(f"{'='*50}\n")
            return True  # Return True in dev mode

# Singleton instance
email_service = EmailService()
