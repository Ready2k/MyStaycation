import 'reflect-metadata';
import { AppDataSource } from './src/config/database';
import { User, UserRole } from './src/entities/User';
import { AlertService } from './src/services/alert.service';

async function verify() {
    console.log('Starting verification script...');
    try {
        await AppDataSource.initialize();
        console.log('✅ Database initialized');

        const userRepo = AppDataSource.getRepository(User);
        const testUser = await userRepo.save(userRepo.create({
            email: 'test_verify@test.com',
            passwordHash: 'hash',
            role: UserRole.USER,
            emailVerified: true
        }));
        console.log('✅ Test user created:', testUser.id);

        // Test alert service ownership check
        const alertService = new AlertService();
        console.log('Testing AlertService.snoozeFingerprint with wrong user...');
        try {
            await alertService.snoozeFingerprint('non-existent-id', 'wrong-user-id', 7);
            console.log('❌ Unexpected success for non-existent-id/wrong-user');
        } catch (e: any) {
            console.log('✅ Correctly failed (as expected for missing ID):', e.message);
        }

        // Cleanup
        await userRepo.remove(testUser);
        console.log('✅ Cleanup complete');
    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

verify();
