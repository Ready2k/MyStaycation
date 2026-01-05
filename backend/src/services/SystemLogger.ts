import { AppDataSource } from '../config/database';
import { SystemLog, LogLevel } from '../entities/SystemLog';

export class SystemLogger {
    private static repo = AppDataSource.getRepository(SystemLog);

    static async log(level: LogLevel, message: string, source: string, details?: any) {
        try {
            const logEntry = new SystemLog();
            logEntry.level = level;
            logEntry.message = message;
            logEntry.source = source;
            logEntry.details = details;

            await this.repo.save(logEntry);
        } catch (error) {
            // Fallback to console if DB fails
            console.error('FAILED TO WRITE SYSTEM LOG:', error);
            console.error('Original Log:', { level, message, source, details });
        }
    }

    static async info(message: string, source: string, details?: any) {
        return this.log(LogLevel.INFO, message, source, details);
    }

    static async warn(message: string, source: string, details?: any) {
        return this.log(LogLevel.WARN, message, source, details);
    }

    static async error(message: string, source: string, details?: any) {
        return this.log(LogLevel.ERROR, message, source, details);
    }
}
