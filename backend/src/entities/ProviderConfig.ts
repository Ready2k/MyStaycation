import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Provider } from './Provider';

export enum ConfigType {
    PARK_CODE = 'PARK_CODE',
    ACCOM_TYPE = 'ACCOM_TYPE',
    REGION = 'REGION',
    VILLAGE = 'VILLAGE'
}

@Entity('provider_configs')
@Index(['provider', 'configType', 'key'], { unique: true })
export class ProviderConfig {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Provider)
    @JoinColumn({ name: 'provider_id' })
    provider!: Provider;

    @Column({ type: 'enum', enum: ConfigType })
    configType!: ConfigType;

    @Column({ type: 'varchar', length: 100 })
    key!: string;

    @Column({ type: 'varchar', length: 100 })
    value!: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    @Column({ type: 'boolean', default: true })
    enabled!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
