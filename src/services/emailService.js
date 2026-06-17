import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import logger from '../config/logger.js';
import { 
  baseEmailTemplate, 
  welcomeEmailBody, 
  welcomeAIBody,
  passwordResetBody, 
  verificationEmailBody 
} from '../templates/emailTemplate.js';

const { OAuth2 } = google.auth;

class EmailService {
  constructor() {
    this.oauth2Client = new OAuth2(
      process.env.GOOGLE_EMAIL_CLIENT_ID,
      process.env.GOOGLE_EMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_EMAIL_REFRESH_TOKEN
    });

    this.transporter = null; // Add transporter cache
    this.transporterExpiry = null;
    this.emailQueue = new Map(); // Track sent emails for rate limiting
    
    // Email metrics
    this.metrics = {
      sent: 0,
      failed: 0,
      lastError: null,
      lastSuccess: null
    };
    
    this.init();
  }

  async init() {
    try {
      await this.refreshTransporter();
      logger.info('Email service initialized successfully');
    } catch (err) {
      logger.error(`CRITICAL: Email service initialization failed: ${err.message}`);
      logger.error('Email functionality will be unavailable');
      // Don't throw - allow app to start but log critical error
      // Emails will fail gracefully with error logging
    }
  }

  async refreshTransporter() {
    try {
      const tokenData = await this.oauth2Client.getAccessToken();

      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GOOGLE_EMAIL_USER,
          accessToken: tokenData?.token,
          clientId: process.env.GOOGLE_EMAIL_CLIENT_ID,
          clientSecret: process.env.GOOGLE_EMAIL_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_EMAIL_REFRESH_TOKEN,
          provisionCallback: this._provisionCallback.bind(this)
        }
      });

      // Set expiry to 50 minutes (tokens last 1 hour, refresh early)
      this.transporterExpiry = Date.now() + (50 * 60 * 1000);
      
      logger.debug('Email transporter refreshed');
      return this.transporter;
    } catch (error) {
      logger.error(`Error creating email transporter: ${error.message}`);
      throw error;
    }
  }

  async _provisionCallback(user, renew, callback) {
    try {
      const tokenData = await this.oauth2Client.getAccessToken();
      logger.debug('Email access token refreshed successfully');
      if (!tokenData.token) {
        return callback(new Error('Unknown user'));
      }
      return callback(null, tokenData.token, tokenData.res?.data?.expiry_date);
    } catch (error) {
      return callback(error);
    }
  }

  async getTransport() {
    // Refresh if expired or doesn't exist
    if (!this.transporter || Date.now() > this.transporterExpiry) {
      await this.refreshTransporter();
    }
    return this.transporter;
  }

  async sendEmail({ to, subject, text, html }) {
    
    console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', to, 'SUBJECT:', subject);
    try {
      const transporter = await this.getTransport();

      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Your App'}" <${process.env.GOOGLE_EMAIL_USER}>`,
        to,
        subject,
        text,
        html: html || text
      };

      const info = await transporter.sendMail(mailOptions);
      
      // Update metrics
      this.metrics.sent += 1;
      this.metrics.lastSuccess = new Date().toISOString();
      
      // Update rate limit tracker
      this.emailQueue.set(to, Date.now());
      
      logger.info(`Email sent to ${to} - Subject: "${subject}" - MessageID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      // Update metrics
      this.metrics.failed += 1;
      this.metrics.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
        recipient: to
      };
      
      logger.error(`Email sending failed to ${to} - Subject: "${subject}" - Error: ${error.message}`);
      throw error;
    }
  }

  // Get email service health status
  getStatus() {
    return {
      healthy: this.transporter !== null,
      metrics: this.metrics,
      transporterExpiry: this.transporterExpiry ? new Date(this.transporterExpiry).toISOString() : null
    };
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to Our Platform';
    const html = baseEmailTemplate({
      title: 'Welcome!',
      body: welcomeEmailBody(user.name)
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request';
    const html = baseEmailTemplate({
      title: 'Reset Your Password',
      body: passwordResetBody(user.name, resetUrl)
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  async sendVerificationEmail(user, verificationToken) {
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const subject = 'Email Verification';
    const html = baseEmailTemplate({
      title: 'Verify Your Email',
      body: verificationEmailBody(user.name, verifyUrl)
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  async sendAiEmail({ to, subject, html }) {
    const htmlContent = baseEmailTemplate({
      title: 'AI Generated Email',
      body: welcomeAIBody(html)
    });

    return this.sendEmail({
      to,
      subject,
      html: htmlContent
    });
  }
}


export default new EmailService();
