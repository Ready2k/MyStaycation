import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ProviderPark } from './ProviderPark';
import { ProviderAccomType } from './ProviderAccomType';
import { PriceObservation } from './PriceObservation';
import { FetchRun } from './FetchRun';
import { Deal } from './Deal';

@Entity('providers')
export class Provider {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ unique: true })
    code!: string; // 'hoseasons', 'haven', 'center_parcs'

    @Column()
    name!: string;

    @Column()
    baseUrl!: string;

    @Column({ type: 'text', nullable: true })
    notes?: string;

    @Column({ default: true })
    enabled!: boolean;

    @Column({ type: 'int', default: 48 })
    checkFrequencyHours!: number;

    @Column({ type: 'int', default: 2 })
    maxConcurrent!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @OneToMany(() => ProviderPark, park => park.provider)
    parks!: ProviderPark[];

    @OneToMany(() => ProviderAccomType, accom => accom.provider)
    accomTypes!: ProviderAccomType[];

    @OneToMany(() => PriceObservation, observation => observation.provider)
    observations!: PriceObservation[];

    @OneToMany(() => FetchRun, run => run.provider)
    fetchRuns!: FetchRun[];

    @OneToMany(() => Deal, deal => deal.provider)
    deals!: Deal[];
}
