import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { emailService } from '../services/email.service';
import { authenticate } from '../middleware/auth';

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

const verifyEmailSchema = z.object({
    token: z.string(),
});

const resetPasswordRequestSchema = z.object({
    email: z.string().email(),
});

const resetPasswordSchema = z.object({
    token: z.string(),
    password: z.string().min(8),
});

export async function authRoutes(fastify: FastifyInstance) {
    // Register
    fastify.post('/auth/register', async (request, reply) => {
        try {
            const { email, password } = registerSchema.parse(request.body);

            const user = await authService.createUser(email, password);

            // Send verification email
            if (user.verificationToken) {
                await emailService.sendVerificationEmail(email, user.verificationToken);
            }

            reply.status(201).send({
                message: 'User created successfully. Please check your email to verify your account.',
                userId: user.id,
            });
        } catch (error: any) {
            if (error.message === 'User already exists') {
                reply.status(409).send({ error: error.message });
            } else {
                reply.status(400).send({ error: error.message });
            }
        }
    });

    // Login
    fastify.post('/auth/login', async (request, reply) => {
        try {
            const { email, password } = loginSchema.parse(request.body);

            const user = await authService.findByEmail(email);
            if (!user) {
                reply.status(401).send({ error: 'Invalid credentials' });
                return;
            }

            const isValid = await authService.comparePassword(password, user.passwordHash);
            if (!isValid) {
                reply.status(401).send({ error: 'Invalid credentials' });
                return;
            }

            if (!user.emailVerified) {
                reply.status(403).send({ error: 'Please verify your email before logging in' });
                return;
            }

            const token = fastify.jwt.sign({ userId: user.id });

            reply.send({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    emailVerified: user.emailVerified,
                },
            });
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    // Verify Email
    fastify.post('/auth/verify-email', async (request, reply) => {
        try {
            const { token } = verifyEmailSchema.parse(request.body);

            const user = await authService.verifyEmail(token);

            reply.send({
                message: 'Email verified successfully',
                user: {
                    id: user.id,
                    email: user.email,
                    emailVerified: user.emailVerified,
                },
            });
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    // Request Password Reset
    fastify.post('/auth/reset-password-request', async (request, reply) => {
        try {
            const { email } = resetPasswordRequestSchema.parse(request.body);

            const token = await authService.initiatePasswordReset(email);
            await emailService.sendPasswordResetEmail(email, token);

            reply.send({
                message: 'Password reset email sent. Please check your inbox.',
            });
        } catch (error: any) {
            // Don't reveal if user exists
            reply.send({
                message: 'If an account exists with that email, a password reset link has been sent.',
            });
        }
    });

    // Reset Password
    fastify.post('/auth/reset-password', async (request, reply) => {
        try {
            const { token, password } = resetPasswordSchema.parse(request.body);

            await authService.resetPassword(token, password);

            reply.send({
                message: 'Password reset successfully. You can now log in with your new password.',
            });
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    // Get current user (protected route)
    fastify.get('/auth/me', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = (request.user as { userId: string }).userId;
        const user = await authService.findById(userId);

        if (!user) {
            reply.status(404).send({ error: 'User not found' });
            return;
        }

        reply.send({
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
            notificationsEnabled: user.notificationsEnabled,
            notificationChannels: user.notificationChannels,
            digestMode: user.digestMode,
        });
    });
}
