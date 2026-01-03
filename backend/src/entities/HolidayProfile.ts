import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from './User';
import { SearchFingerprint } from './SearchFingerprint';

export enum FlexType {
    FIXED = 'FIXED',
    RANGE = 'RANGE',
    FLEXI = 'FLEXI'
}

export enum PeakTolerance {
    OFFPEAK_ONLY = 'OFFPEAK_ONLY',
    MIXED = 'MIXED',
    PEAK_OK = 'PEAK_OK'
}

@Entity('holiday_profiles')
export class HolidayProfile {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => User, user => user.profiles, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column()
    name!: string;

    @Column({ type: 'int', default: 2 })
    partySizeAdults!: number;

    @Column({ type: 'int', default: 0 })
    partySizeChildren!: number;

    @Column({ type: 'enum', enum: FlexType, default: FlexType.RANGE })
    flexType!: FlexType;

    @Column({ type: 'date', nullable: true })
    dateStart?: Date;

    @Column({ type: 'date', nullable: true })
    dateEnd?: Date;

    @Column({ type: 'int', default: 3 })
    durationNightsMin!: number;

    @Column({ type: 'int', default: 7 })
    durationNightsMax!: number;

    @Column({ type: 'enum', enum: PeakTolerance, default: PeakTolerance.MIXED })
    peakTolerance!: PeakTolerance;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    budgetCeilingGbp?: number;

    @Column({ default: true })
    enabled!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @OneToMany(() => SearchFingerprint, fingerprint => fingerprint.profile)
    fingerprints!: SearchFingerprint[];
}
