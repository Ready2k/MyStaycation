import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { SearchFingerprint } from '../entities/SearchFingerprint';
import { authenticate } from '../middleware/auth';
import bcrypt from 'bcrypt';
import z from 'zod';

const userRepo = AppDataSource.getRepository(User);
const fingerprintRepo = AppDataSource.getRepository(SearchFingerprint);

// Validation schemas
const updateProfileSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional(),
    mobile: z.string().regex(/^\+[1-9]\d{1,14}$/).optional().nullable(), // E.164 format
    language: z.enum(['en', 'es', 'fr', 'de', 'it']).optional(),
    defaultCheckFrequencyHours: z.number().int().min(12).max(168).optional(), // 12h to 1 week
});

const deleteAccountSchema = z.object({
    confirmation: z.literal('DELETE'),
});

export async function usersRoutes(fastify: FastifyInstance) {
    // GET /users/me - Get current user profile
    fastify.get('/users/me', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = (request as any).user.userId;

        try {
            const user = await userRepo.findOne({
                where: { id: userId },
                select: ['id', 'name', 'email', 'mobile', 'language', 'defaultCheckFrequencyHours', 'emailVerified', 'createdAt', 'role'],
            });

            if (!user) {
                return reply.code(404).send({ error: 'User not found' });
            }

            return reply.send({ user });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Failed to fetch user profile' });
        }
    });

    // PATCH /users/me - Update user profile
    fastify.patch('/users/me', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = (request as any).user.userId;

        try {
            const validated = updateProfileSchema.parse(request.body);

            const user = await userRepo.findOne({ where: { id: userId } });
            if (!user) {
                return reply.code(404).send({ error: 'User not found' });
            }

            // Check email uniqueness if changing email
            if (validated.email && validated.email !== user.email) {
                const existingUser = await userRepo.findOne({ where: { email: validated.email } });
                if (existingUser) {
                    return reply.code(400).send({ error: 'Email already in use' });
                }
                user.email = validated.email;
                user.emailVerified = false; // Reset verification if email changes
            }

            // Update fields
            if (validated.name !== undefined) user.name = validated.name;
            if (validated.mobile !== undefined) user.mobile = validated.mobile ?? undefined;
            if (validated.language !== undefined) user.language = validated.language;

            // Update default check frequency and propagate to all fingerprints
            if (validated.defaultCheckFrequencyHours !== undefined) {
                const oldFrequency = user.defaultCheckFrequencyHours;
                user.defaultCheckFrequencyHours = validated.defaultCheckFrequencyHours;

                // Update all user's fingerprints
                await fingerprintRepo
                    .createQueryBuilder()
                    .update(SearchFingerprint)
                    .set({ checkFrequencyHours: validated.defaultCheckFrequencyHours })
                    .where('profile_id IN (SELECT id FROM holiday_profiles WHERE user_id = :userId)', { userId })
                    .execute();

                request.log.info(`Updated check frequency from ${oldFrequency}h to ${validated.defaultCheckFrequencyHours}h for user ${userId}`);
            }

            await userRepo.save(user);

            // Return updated user (exclude password hash)
            const { passwordHash, ...userWithoutPassword } = user;
            return reply.send({ user: userWithoutPassword });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Validation failed', details: error.errors });
            }
            request.log.error(error);
            return reply.code(500).send({ error: 'Failed to update user profile' });
        }
    });

    // DELETE /users/me - Delete account and all associated data
    fastify.delete('/users/me', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = (request as any).user.userId;

        try {
            const validated = deleteAccountSchema.parse(request.body);

            const user = await userRepo.findOne({ where: { id: userId } });
            if (!user) {
                return reply.code(404).send({ error: 'User not found' });
            }

            // Delete user (cascade will handle related data)
            await userRepo.remove(user);

            request.log.info(`User account deleted: ${userId} (${user.email})`);

            return reply.send({
                success: true,
                message: 'Account successfully deleted. All your data has been removed.'
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Confirmation required. Please type DELETE to confirm.' });
            }
            request.log.error(error);
            return reply.code(500).send({ error: 'Failed to delete account' });
        }
    });
}
