/* eslint-disable */
export const baseEmailTemplate = ({ title, body, footerText = 'Thank you for using our service!' }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a1a !important; }
      .email-container { background-color: #2d2d2d !important; }
      .email-text { color: #e0e0e0 !important; }
      .email-heading { color: #a5b4fc !important; }
      .email-footer { background-color: #1f1f1f !important; border-top: 1px solid #404040 !important; }
      .email-footer-text { color: #a0a0a0 !important; }
      .divider-line { background-color: #404040 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;" class="email-bg">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f4;" class="email-bg">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; max-width: 600px;" class="email-container">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #667eea; padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">
                ${process.env.EMAIL_FROM_NAME || 'Your App'}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px; color: #333333; font-size: 16px; line-height: 1.6; font-family: Arial, Helvetica, sans-serif;" class="email-text">
              ${body}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; color: #666666; font-size: 14px; border-top: 1px solid #e0e0e0;" class="email-footer">
              <p style="margin: 5px 0; font-family: Arial, Helvetica, sans-serif;" class="email-footer-text">${footerText}</p>
              <p style="margin: 5px 0; font-family: Arial, Helvetica, sans-serif;" class="email-footer-text">&copy; ${new Date().getFullYear()} ${process.env.EMAIL_FROM_NAME || 'Your App'}. All rights reserved.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

export const welcomeEmailBody = (name) => `
  <h2 style="color: #667eea; font-size: 24px; margin-top: 0; font-family: Arial, Helvetica, sans-serif;" class="email-heading">Welcome, ${name}! 🎉</h2>
  <p style="font-size: 16px; margin: 15px 0; color: #333333; font-family: Arial, Helvetica, sans-serif;" class="email-text">Thank you for joining us. We're excited to have you on board!</p>
  <p style="font-size: 16px; margin: 15px 0; color: #333333; font-family: Arial, Helvetica, sans-serif;" class="email-text">Your account has been successfully created and you can now access all our features.</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding: 20px 0;">
        <div style="height: 1px; background-color: #e0e0e0;" class="divider-line"></div>
      </td>
    </tr>
  </table>
  <p style="font-size: 16px; margin: 15px 0; color: #333333; font-family: Arial, Helvetica, sans-serif;" class="email-text">If you have any questions, feel free to reach out to our support team.</p>
`;

export const passwordResetBody = (name, resetUrl) => `
  <h2 style="color: #667eea; font-size: 24px; margin-top: 0; font-family: Arial, Helvetica, sans-serif;" class="email-heading">Password Reset Request</h2>
  <p style="font-size: 16px; margin: 15px 0; color: #333333; font-family: Arial, Helvetica, sans-serif;" class="email-text">Hi ${name},</p>
  <p style="font-size: 16px; margin: 15px 0; color: #333333; font-family: Arial, Helvetica, sans-serif;" class="email-text">We received a request to reset your password. Click the button below to create a new password:</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 14px 30px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 16px; font-family: Arial, Helvetica, sans-serif;">Reset Password</a>
      </td>
    </tr>
  </table>
  <p style="color: #666666; font-size: 14px; margin: 15px 0; font-family: Arial, Helvetica, sans-serif;" class="email-footer-text">This link will expire in 1 hour for security reasons.</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding: 20px 0;">
        <div style="height: 1px; background-color: #e0e0e0;" class="divider-line"></div>
      </td>
    </tr>
  </table>
  <p style="font-size: 16px; margin: 15px 0; color: #333333; font-family: Arial, Helvetica, sans-serif;" class="email-text">If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
`;

export const verificationEmailBody = (name, verifyUrl) => `
  <h2 style="color: #667eea; font-size: 24px; margin-top: 0; font-family: Arial, Helvetica, sans-serif;" class="email-heading">Verify Your Email Address</h2>
  <p style="font-size: 16px; margin: 15px 0; color: #333333; font-family: Arial, Helvetica, sans-serif;" class="email-text">Hi ${name},</p>
  <p style="font-size: 16px; margin: 15px 0; color: #333333; font-family: Arial, Helvetica, sans-serif;" class="email-text">Thanks for signing up! Please verify your email address to activate your account.</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <a href="${verifyUrl}" style="display: inline-block; padding: 14px 30px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 16px; font-family: Arial, Helvetica, sans-serif;">Verify Email</a>
      </td>
    </tr>
  </table>
  <p style="color: #666666; font-size: 14px; margin: 15px 0; font-family: Arial, Helvetica, sans-serif;" class="email-footer-text">This verification link will expire in 24 hours.</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding: 20px 0;">
        <div style="height: 1px; background-color: #e0e0e0;" class="divider-line"></div>
      </td>
    </tr>
  </table>
  <p style="font-size: 16px; margin: 15px 0; color: #333333; font-family: Arial, Helvetica, sans-serif;" class="email-text">If you didn't create an account, you can safely ignore this email.</p>
`;

export const welcomeAIBody = (text) => `
  <h2 style="color: #667eea; font-size: 24px; margin-top: 0; font-family: Arial, Helvetica, sans-serif;" class="email-heading"> ${text}!</h2>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding: 20px 0;">
        <div style="height: 1px; background-color: #e0e0e0;" class="divider-line"></div>
      </td>
    </tr>
  </table>
  <p style="font-size: 16px; margin: 15px 0; color: #333333; font-family: Arial, Helvetica, sans-serif;" class="email-text">If you have any questions, feel free to reach out to our support team.</p>
`;