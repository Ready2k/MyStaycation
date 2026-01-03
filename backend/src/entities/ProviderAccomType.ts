import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Provider } from './Provider';

@Entity('provider_accom_types')
@Index(['provider', 'providerAccomCode'], { unique: true })
export class ProviderAccomType {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Provider, provider => provider.accomTypes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'provider_id' })
    provider!: Provider;

    @Column({ nullable: true })
    providerAccomCode?: string;

    @Column()
    name!: string;

    @Column({ type: 'int', nullable: true })
    capacityMin?: number;

    @Column({ type: 'int', nullable: true })
    capacityMax?: number;
}
