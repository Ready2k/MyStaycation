import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { Provider } from './Provider';
import { SearchFingerprint } from './SearchFingerprint';
import { FetchRun } from './FetchRun';
import { ProviderAccomType } from './ProviderAccomType';

export enum AvailabilityStatus {
    AVAILABLE = 'AVAILABLE',
    SOLD_OUT = 'SOLD_OUT',
    UNKNOWN = 'UNKNOWN'
}

@Entity('price_observations')
@Index(['fingerprint', 'stayStartDate', 'stayNights', 'observedAt'])
export class PriceObservation {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Provider, provider => provider.observations)
    @JoinColumn({ name: 'provider_id' })
    provider!: Provider;

    @ManyToOne(() => SearchFingerprint, fingerprint => fingerprint.observations, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'fingerprint_id' })
    fingerprint!: SearchFingerprint;

    @ManyToOne(() => FetchRun, { nullable: true })
    @JoinColumn({ name: 'fetch_run_id' })
    fetchRun?: FetchRun;

    @ManyToOne(() => ProviderAccomType, { nullable: true })
    @JoinColumn({ name: 'accom_type_id' })
    accomType?: ProviderAccomType;

    @Column({ type: 'date' })
    stayStartDate!: Date;

    @Column({ type: 'int' })
    stayNights!: number;

    @Column({ type: 'jsonb', nullable: true })
    partySize?: { adults: number; children: number };

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    priceTotalGbp!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    pricePerNightGbp!: number;

    @Column({ type: 'enum', enum: AvailabilityStatus, default: AvailabilityStatus.UNKNOWN })
    availability!: AvailabilityStatus;

    @Column({ default: 'GBP' })
    currency!: string;

    @Column({ type: 'text', nullable: true })
    sourceUrl?: string;

    @CreateDateColumn()
    observedAt!: Date;
}
