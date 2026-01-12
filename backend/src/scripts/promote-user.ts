import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';

async function promoteUser() {
    const email = process.argv[2];

    if (!email) {
        console.error('❌ Please provide an email address: npx tsx scripts/promote-user.ts user@example.com');
        process.exit(1);
    }

    try {
        console.log(`🔍 Connecting to database...`);
        await AppDataSource.initialize();

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { email: email.toLowerCase() } });

        if (!user) {
            console.error(`❌ User not found with email: ${email}`);
            process.exit(1);
        }

        user.role = UserRole.ADMIN;
        await userRepository.save(user);

        console.log(`✅ Success! User ${email} has been promoted to ADMIN.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to promote user:', error);
        process.exit(1);
    }
}

promoteUser();
