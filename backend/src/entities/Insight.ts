import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
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
    details!: Record<string, any>;

    @CreateDateColumn()
    createdAt!: Date;

    @OneToMany(() => Alert, alert => alert.insight)
    alerts!: Alert[];
}
