import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppDataSource } from '../config/database';
import { HolidayProfile, FlexType, PeakTolerance, AccommodationType, AccommodationTier, StayPattern, SchoolHolidayMatch, AlertSensitivity } from '../entities/HolidayProfile';
import { User } from '../entities/User';
import z from 'zod';

// Validation schemas
export const createProfileSchema = z.object({
    name: z.string().min(1, "Name is required"),
    partySizeAdults: z.number().int().min(1).default(2),
    partySizeChildren: z.number().int().min(0).default(0),
    flexType: z.nativeEnum(FlexType).default(FlexType.RANGE),
    dateStart: z.string().optional().transform(str => str ? new Date(str) : undefined),
    dateEnd: z.string().optional().transform(str => str ? new Date(str) : undefined),
    durationNightsMin: z.number().int().min(1).default(3),
    durationNightsMax: z.number().int().min(1).default(7),
    peakTolerance: z.nativeEnum(PeakTolerance).default(PeakTolerance.MIXED),
    budgetCeilingGbp: z.number().optional(),
    enabled: z.boolean().default(true),
    pets: z.boolean().default(false),
    // New Fields
    accommodationType: z.nativeEnum(AccommodationType).default(AccommodationType.ANY),
    minBedrooms: z.number().int().min(0).default(0),
    tier: z.nativeEnum(AccommodationTier).default(AccommodationTier.STANDARD),
    stayPattern: z.nativeEnum(StayPattern).default(StayPattern.ANY),
    schoolHolidays: z.nativeEnum(SchoolHolidayMatch).default(SchoolHolidayMatch.ALLOW),
    petsNumber: z.number().int().min(0).default(0),
    stepFreeAccess: z.boolean().default(false),
    accessibleBathroom: z.boolean().default(false),
    requiredFacilities: z.array(z.string()).default([]),
    alertSensitivity: z.nativeEnum(AlertSensitivity).default(AlertSensitivity.INSTANT)
});

const updateProfileSchema = createProfileSchema.partial();

export async function profileRoutes(fastify: FastifyInstance) {
    const profileRepo = AppDataSource.getRepository(HolidayProfile);

    // GET /profiles - List all profiles for the current user
    fastify.get('/profiles', {
        onRequest: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as any;

        try {
            const profiles = await profileRepo.find({
                where: { user: { id: user.id } },
                order: { createdAt: 'DESC' }
            });
            return profiles;
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ message: 'Internal Server Error' });
        }
    });

    // POST /profiles - Create a new profile
    fastify.post('/profiles', {
        onRequest: [fastify.authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as any; // JWT user payload

        try {
            const validatedData = createProfileSchema.parse(request.body);

            const profile = profileRepo.create({
                ...validatedData,
                user: { id: user.id } as User // specific user reference
            });

            await profileRepo.save(profile);

            return reply.code(201).send(profile);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ message: 'Validation Error', errors: error.errors });
            }
            request.log.error(error);
            return reply.code(500).send({ message: 'Failed to create profile' });
        }
    });

    // GET /profiles/:id - Get a specific profile
    fastify.get<{ Params: { id: string } }>('/profiles/:id', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const user = request.user as any;
        const { id } = request.params;

        try {
            const profile = await profileRepo.findOne({
                where: { id, user: { id: user.id } }
            });

            if (!profile) {
                return reply.code(404).send({ message: 'Profile not found' });
            }

            return profile;
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ message: 'Internal Server Error' });
        }
    });

    // PUT /profiles/:id - Update a profile
    fastify.put<{ Params: { id: string } }>('/profiles/:id', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const user = request.user as any;
        const { id } = request.params;

        try {
            const profile = await profileRepo.findOne({
                where: { id, user: { id: user.id } }
            });

            if (!profile) {
                return reply.code(404).send({ message: 'Profile not found' });
            }

            const validatedData = updateProfileSchema.parse(request.body);

            // Merge updates
            profileRepo.merge(profile, validatedData);

            await profileRepo.save(profile);

            return profile;
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ message: 'Validation Error', errors: error.errors });
            }
            request.log.error(error);
            return reply.code(500).send({ message: 'Failed to update profile' });
        }
    });

    // DELETE /profiles/:id - Delete a profile
    fastify.delete<{ Params: { id: string } }>('/profiles/:id', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        const user = request.user as any;
        const { id } = request.params;

        try {
            const profile = await profileRepo.findOne({
                where: { id, user: { id: user.id } }
            });

            if (!profile) {
                return reply.code(404).send({ message: 'Profile not found' });
            }

            await profileRepo.delete(id);

            return reply.code(204).send();
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ message: 'Failed to delete profile' });
        }
    });
}
