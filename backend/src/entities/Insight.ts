import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, OneToMany, Index } from 'typeorm';
import { SearchFingerprint } from './SearchFingerprint';
import { Alert } from './Alert';

export enum InsightType {
    LOWEST_IN_X_DAYS = 'LOWEST_IN_X_DAYS',
    PRICE_DROP_PERCENT = 'PRICE_DROP_PERCENT',
    NEW_CAMPAIGN_DETECTED = 'NEW_CAMPAIGN_DETECTED',
    RISK_RISING = 'RISK_RISING',
    VOUCHER_SPOTTED = 'VOUCHER_SPOTTED'
}

@Entity('insights')
@Index(['dedupeKey'], { unique: true })
export class Insight {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => SearchFingerprint, fingerprint => fingerprint.insights, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'fingerprint_id' })
    fingerprint!: SearchFingerprint;

    @Column({ type: 'enum', enum: InsightType })
    type!: InsightType;

    @Column({ type: 'text' })
    summary!: string;

    @Column({ type: 'jsonb' })
    details!: Record<string, unknown>;

    @Column({ type: 'varchar', unique: true })
    dedupeKey!: string;

    @Column({ type: 'varchar' })
    seriesKey!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @OneToMany(() => Alert, alert => alert.insight)
    alerts!: Alert[];
}
