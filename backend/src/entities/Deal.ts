import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Provider } from './Provider';

export enum DealSource {
    PROVIDER_OFFERS = 'PROVIDER_OFFERS',
    HOTUKDEALS = 'HOTUKDEALS',
    OTHER = 'OTHER'
}

export enum DiscountType {
    PERCENT_OFF = 'PERCENT_OFF',
    FIXED_OFF = 'FIXED_OFF',
    SALE_PRICE = 'SALE_PRICE',
    PERK = 'PERK'
}

@Entity('deals')
@Index(['source', 'sourceRef'], { unique: true })
export class Deal {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Provider, provider => provider.deals, { nullable: true })
    @JoinColumn({ name: 'provider_id' })
    provider?: Provider;

    @Column({ type: 'enum', enum: DealSource })
    source!: DealSource;

    @Column()
    sourceRef!: string;

    @Column()
    title!: string;

    @Column({ type: 'enum', enum: DiscountType })
    discountType!: DiscountType;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    discountValue?: number;

    @Column({ nullable: true })
    voucherCode?: string;

    @Column({ type: 'simple-array', default: '' })
    eligibilityTags!: string[];

    @Column({ type: 'jsonb', nullable: true })
    restrictions?: Record<string, any>;

    @Column({ type: 'timestamp', nullable: true })
    startsAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    endsAt?: Date;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.5 })
    confidence!: number;

    @CreateDateColumn()
    detectedAt!: Date;

    @UpdateDateColumn()
    lastSeenAt!: Date;
}
