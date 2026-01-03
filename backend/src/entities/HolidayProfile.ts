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

export enum AccommodationType {
    ANY = 'ANY',
    LODGE = 'LODGE',
    CARAVAN = 'CARAVAN',
    APARTMENT = 'APARTMENT',
    COTTAGE = 'COTTAGE',
    HOTEL = 'HOTEL'
}

export enum AccommodationTier {
    STANDARD = 'STANDARD',
    PREMIUM = 'PREMIUM',
    LUXURY = 'LUXURY'
}

export enum StayPattern {
    ANY = 'ANY',
    MIDWEEK = 'MIDWEEK',
    WEEKEND = 'WEEKEND',
    FULL_WEEK = 'FULL_WEEK'
}

export enum SchoolHolidayMatch {
    ALLOW = 'ALLOW',
    AVOID = 'AVOID',
    ONLY = 'ONLY'
}

export enum AlertSensitivity {
    INSTANT = 'INSTANT',
    DIGEST = 'DIGEST',
    EXCEPTIONAL_ONLY = 'EXCEPTIONAL_ONLY'
}

@Entity('holiday_profiles')
export class HolidayProfile {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => User, user => user.profiles, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column({ type: 'varchar' })
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

    @Column({ type: 'boolean', default: true })
    enabled!: boolean;

    @Column({ type: 'boolean', default: false })
    pets!: boolean;

    // --- ACCOMMODATION ---
    @Column({ type: 'enum', enum: AccommodationType, default: AccommodationType.ANY })
    accommodationType!: AccommodationType;

    @Column({ type: 'int', default: 0 })
    minBedrooms!: number;

    @Column({ type: 'enum', enum: AccommodationTier, default: AccommodationTier.STANDARD })
    tier!: AccommodationTier;

    // --- DATES & FLEXIBILITY ---
    @Column({ type: 'enum', enum: StayPattern, default: StayPattern.ANY })
    stayPattern!: StayPattern;

    @Column({ type: 'enum', enum: SchoolHolidayMatch, default: SchoolHolidayMatch.ALLOW })
    schoolHolidays!: SchoolHolidayMatch;

    // --- PETS & ACCESSIBILITY ---
    @Column({ type: 'int', default: 0 })
    petsNumber!: number;

    @Column({ type: 'boolean', default: false })
    stepFreeAccess!: boolean;

    @Column({ type: 'boolean', default: false })
    accessibleBathroom!: boolean;

    // --- FACILITIES ---
    @Column({ type: 'simple-array', default: '' })
    requiredFacilities!: string[];

    // --- ALERTS ---
    @Column({ type: 'enum', enum: AlertSensitivity, default: AlertSensitivity.INSTANT })
    alertSensitivity!: AlertSensitivity;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @OneToMany(() => SearchFingerprint, fingerprint => fingerprint.profile)
    fingerprints!: SearchFingerprint[];
}
