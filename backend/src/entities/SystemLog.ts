import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

@Entity('system_logs')
export class SystemLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column({ type: 'enum', enum: LogLevel })
    level!: LogLevel;

    @Column({ type: 'text' })
    message!: string;

    @Column({ type: 'varchar' })
    source!: string; // e.g. 'API', 'WORKER', 'SCHEDULER'

    @Column({ type: 'jsonb', nullable: true })
    details?: any;

    @Index()
    @CreateDateColumn()
    createdAt!: Date;
}
