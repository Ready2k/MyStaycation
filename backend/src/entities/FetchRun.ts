import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { Provider } from './Provider';
import { SearchFingerprint } from './SearchFingerprint';

export enum RunType {
    SEARCH = 'SEARCH',
    OFFERS_PAGE = 'OFFERS_PAGE',
    DEAL_SOURCE = 'DEAL_SOURCE',
    MANUAL_PREVIEW = 'MANUAL_PREVIEW'
}

export enum RunStatus {
    OK = 'OK',
    ERROR = 'ERROR',
    BLOCKED = 'BLOCKED',
    PARSE_FAILED = 'PARSE_FAILED'
}

@Entity('fetch_runs')
@Index(['provider', 'startedAt'])
export class FetchRun {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Provider, provider => provider.fetchRuns)
    @JoinColumn({ name: 'provider_id' })
    provider!: Provider;

    @ManyToOne(() => SearchFingerprint, { nullable: true })
    @JoinColumn({ name: 'fingerprint_id' })
    fingerprint?: SearchFingerprint;

    @Column({ type: 'enum', enum: RunType })
    runType!: RunType;

    @Column({ type: 'timestamp' })
    scheduledFor!: Date;

    @Column({ type: 'timestamp', nullable: true })
    startedAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    finishedAt?: Date;

    @Column({ type: 'enum', enum: RunStatus })
    status!: RunStatus;

    @Column({ type: 'int', nullable: true })
    httpStatus?: number;

    @Column({ type: 'varchar', nullable: true })
    requestFingerprint?: string;

    @Column({ type: 'text', nullable: true })
    responseSnapshotRef?: string;

    @Column({ type: 'text', nullable: true })
    errorMessage?: string;

    @CreateDateColumn()
    createdAt!: Date;
}
