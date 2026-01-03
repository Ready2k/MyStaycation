import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

const userRepository = AppDataSource.getRepository(User);

export class AuthService {
    async hashPassword(password: string): Promise<string> {
        const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
        return bcrypt.hash(password, rounds);
    }

    async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    generateToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    async createUser(email: string, password: string): Promise<User> {
        const existingUser = await userRepository.findOne({ where: { email } });
        if (existingUser) {
            throw new Error('User already exists');
        }

        const hashedPassword = await this.hashPassword(password);
        const emailVerificationToken = this.generateToken();

        const user = userRepository.create({
            email,
            password: hashedPassword,
            emailVerificationToken,
            emailVerified: false,
            notificationsEnabled: true,
            notificationChannels: ['email'],
            digestMode: false,
        });

        return userRepository.save(user);
    }

    async verifyEmail(token: string): Promise<User> {
        const user = await userRepository.findOne({
            where: { emailVerificationToken: token },
        });

        if (!user) {
            throw new Error('Invalid verification token');
        }

        user.emailVerified = true;
        user.emailVerificationToken = undefined;

        return userRepository.save(user);
    }

    async findByEmail(email: string): Promise<User | null> {
        return userRepository.findOne({ where: { email } });
    }

    async findById(id: string): Promise<User | null> {
        return userRepository.findOne({ where: { id } });
    }

    async initiatePasswordReset(email: string): Promise<string> {
        const user = await this.findByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }

        const resetToken = this.generateToken();
        const resetExpires = new Date();
        resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

        user.passwordResetToken = resetToken;
        user.passwordResetExpires = resetExpires;

        await userRepository.save(user);
        return resetToken;
    }

    async resetPassword(token: string, newPassword: string): Promise<User> {
        const user = await userRepository.findOne({
            where: { passwordResetToken: token },
        });

        if (!user || !user.passwordResetExpires) {
            throw new Error('Invalid reset token');
        }

        if (new Date() > user.passwordResetExpires) {
            throw new Error('Reset token expired');
        }

        user.password = await this.hashPassword(newPassword);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;

        return userRepository.save(user);
    }
}

export const authService = new AuthService();
