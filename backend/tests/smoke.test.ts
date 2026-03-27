import 'reflect-metadata';
import { describe, it, expect } from '@jest/globals';
import { ENTITIES } from '../src/entities';
import { User } from '../src/entities/User';

describe('Smoke Test: Entity Registry', () => {
    it('should have 13 entities registered', () => {
        expect(ENTITIES.length).toBe(13);
    });

    it('should include the User entity', () => {
        const hasUser = ENTITIES.some(e => e === User);
        expect(hasUser).toBe(true);
    });

    it('should have names for all entities', () => {
        ENTITIES.forEach(entity => {
            expect((entity as any).name).toBeDefined();
        });
    });
});
