import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { HolidayProfile } from './HolidayProfile';
import { Provider } from './Provider';
import { ProviderPark } from './ProviderPark';
import { ProviderAccomType } from './ProviderAccomType';
import { PriceObservation } from './PriceObservation';
import { Insight } from './Insight';

@Entity('search_fingerprints')
@Index(['canonicalHash'], { unique: true })
export class SearchFingerprint {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => HolidayProfile, profile => profile.fingerprints, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'profile_id' })
    profile!: HolidayProfile;

    @ManyToOne(() => Provider)
    @JoinColumn({ name: 'provider_id' })
    provider!: Provider;

    @ManyToOne(() => ProviderPark, { nullable: true })
    @JoinColumn({ name: 'park_id' })
    park?: ProviderPark;

    @ManyToOne(() => ProviderAccomType, { nullable: true })
    @JoinColumn({ name: 'accom_type_id' })
    accomType?: ProviderAccomType;

    @Column({ unique: true })
    canonicalHash!: string;

    @Column({ type: 'jsonb' })
    canonicalJson!: Record<string, any>;

    @Column({ type: 'int', default: 48 })
    checkFrequencyHours!: number;

    @Column({ type: 'timestamp', nullable: true })
    lastScheduledAt?: Date;

    @Column({ default: true })
    enabled!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @OneToMany(() => PriceObservation, observation => observation.fingerprint)
    observations!: PriceObservation[];

    @OneToMany(() => Insight, insight => insight.fingerprint)
    insights!: Insight[];
}
