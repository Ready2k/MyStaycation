import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { User } from './User';
import { Insight } from './Insight';

export enum AlertStatus {
    PENDING = 'PENDING',
    SENT = 'SENT',
    FAILED = 'FAILED',
    DISMISSED = 'DISMISSED'
}

export enum AlertChannel {
    EMAIL = 'EMAIL',
    PUSH = 'PUSH',
    SMS = 'SMS'
}

@Entity('alerts')
@Index(['dedupeKey'], { unique: true })
export class Alert {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => User, user => user.alerts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @ManyToOne(() => Insight, insight => insight.alerts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'insight_id' })
    insight!: Insight;

    @Column({ type: 'enum', enum: AlertChannel, default: AlertChannel.EMAIL })
    channel!: AlertChannel;

    @Column({ type: 'enum', enum: AlertStatus, default: AlertStatus.PENDING })
    status!: AlertStatus;

    @Column({ type: 'varchar', unique: true })
    dedupeKey!: string;

    @Column({ type: 'text', nullable: true })
    errorMessage?: string;

    @Column({ type: 'timestamp', nullable: true })
    sentAt?: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
