import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Provider } from './Provider';

@Entity('provider_parks')
@Index(['provider', 'providerParkCode'], { unique: true })
export class ProviderPark {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Provider, provider => provider.parks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'provider_id' })
    provider!: Provider;

    @Column({ nullable: true })
    providerParkCode?: string;

    @Column()
    name!: string;

    @Column({ nullable: true })
    region?: string;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    latitude?: number;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    longitude?: number;
}
