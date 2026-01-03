import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as nodemailer from 'nodemailer';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export class EmailService {
    private sesClient?: SESClient;
    private smtpTransporter?: nodemailer.Transporter;
    private provider: string;
    private fromAddress: string;

    constructor() {
        this.provider = process.env.EMAIL_PROVIDER || 'ses';
        this.fromAddress = process.env.EMAIL_FROM || 'noreply@staycation-watcher.com';

        if (this.provider === 'ses') {
            this.sesClient = new SESClient({
                region: process.env.AWS_REGION || 'eu-west-1',
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
                },
            });
        } else {
            this.smtpTransporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD,
                },
            });
        }
    }

    async sendEmail(options: EmailOptions): Promise<void> {
        try {
            if (this.provider === 'ses' && this.sesClient) {
                await this.sendViaSES(options);
            } else if (this.smtpTransporter) {
                await this.sendViaSMTP(options);
            } else {
                console.warn('⚠️  Email service not configured, logging email instead:');
                console.log(JSON.stringify(options, null, 2));
            }
        } catch (error) {
            console.error('❌ Failed to send email:', error);
            throw error;
        }
    }

    private async sendViaSES(options: EmailOptions): Promise<void> {
        const command = new SendEmailCommand({
            Source: this.fromAddress,
            Destination: {
                ToAddresses: [options.to],
            },
            Message: {
                Subject: {
                    Data: options.subject,
                },
                Body: {
                    Html: {
                        Data: options.html,
                    },
                    Text: options.text ? {
                        Data: options.text,
                    } : undefined,
                },
            },
        });

        await this.sesClient!.send(command);
        console.log(`✅ Email sent via SES to ${options.to}`);
    }

    private async sendViaSMTP(options: EmailOptions): Promise<void> {
        await this.smtpTransporter!.sendMail({
            from: this.fromAddress,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
        console.log(`✅ Email sent via SMTP to ${options.to}`);
    }

    async sendVerificationEmail(email: string, token: string): Promise<void> {
        const verificationUrl = `${process.env.APP_URL}/auth/verify?token=${token}`;

        await this.sendEmail({
            to: email,
            subject: 'Verify your email - UK Staycation Watcher',
            html: `
        <h1>Welcome to UK Staycation Watcher!</h1>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationUrl}">Verify Email</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
      `,
            text: `Welcome to UK Staycation Watcher! Please verify your email by visiting: ${verificationUrl}`,
        });
    }

    async sendPasswordResetEmail(email: string, token: string): Promise<void> {
        const resetUrl = `${process.env.APP_URL}/auth/reset-password?token=${token}`;

        await this.sendEmail({
            to: email,
            subject: 'Password Reset - UK Staycation Watcher',
            html: `
        <h1>Password Reset Request</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
            text: `Password reset requested. Visit: ${resetUrl}`,
        });
    }

    async sendAlertEmail(email: string, alertData: {
        profileName: string;
        insightSummary: string;
        details: any;
    }): Promise<void> {
        await this.sendEmail({
            to: email,
            subject: `Price Alert: ${alertData.profileName}`,
            html: `
        <h1>🎯 Price Alert!</h1>
        <h2>${alertData.profileName}</h2>
        <p><strong>${alertData.insightSummary}</strong></p>
        <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <pre>${JSON.stringify(alertData.details, null, 2)}</pre>
        </div>
        <p><a href="${process.env.APP_URL}/dashboard">View in Dashboard</a></p>
      `,
            text: `Price Alert: ${alertData.profileName}\n\n${alertData.insightSummary}\n\nView details at: ${process.env.APP_URL}/dashboard`,
        });
    }
}

export const emailService = new EmailService();
