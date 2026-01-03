import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { User } from './User';
import { HolidayProfile } from './HolidayProfile';
import { Insight } from './Insight';

export enum AlertChannel {
    EMAIL = 'EMAIL',
    PUSH = 'PUSH',
    SMS = 'SMS'
}

export enum AlertStatus {
    QUEUED = 'QUEUED',
    SENT = 'SENT',
    FAILED = 'FAILED',
    DISMISSED = 'DISMISSED'
}

@Entity('alerts')
@Index(['user', 'dedupeKey'], { unique: true })
export class Alert {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => User, user => user.alerts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @ManyToOne(() => HolidayProfile, { nullable: true })
    @JoinColumn({ name: 'profile_id' })
    profile?: HolidayProfile;

    @ManyToOne(() => Insight)
    @JoinColumn({ name: 'insight_id' })
    insight!: Insight;

    @Column({ type: 'enum', enum: AlertChannel })
    channel!: AlertChannel;

    @Column({ type: 'enum', enum: AlertStatus, default: AlertStatus.QUEUED })
    status!: AlertStatus;

    @Column({ type: 'timestamp', nullable: true })
    sentAt?: Date;

    @Column()
    dedupeKey!: string;

    @CreateDateColumn()
    createdAt!: Date;
}
