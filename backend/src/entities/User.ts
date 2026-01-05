import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { HolidayProfile } from './HolidayProfile';
import { Alert } from './Alert';

export enum UserRole {
    USER = 'USER',
    ADMIN = 'ADMIN'
}


@Entity('users')
@Index(['email'], { unique: true })
export class User {
    @PrimaryGeneratedColumn('uuid')
    id!: string;


    @Column({ type: 'varchar', unique: true })
    email!: string;

    @Column({ type: 'varchar' })
    passwordHash!: string;

    @Column({ type: 'varchar', nullable: true })
    name?: string;

    @Column({ type: 'varchar', nullable: true })
    mobile?: string;

    @Column({ type: 'varchar', default: 'en' })
    language!: string;

    @Column({ type: 'int', default: 48 })
    defaultCheckFrequencyHours!: number;

    @Column({ type: 'boolean', default: false })
    emailVerified!: boolean;

    @Column({ type: 'varchar', nullable: true })
    verificationToken?: string;

    @Column({ type: 'timestamp', nullable: true })
    verificationTokenExpires?: Date;

    @Column({ type: 'varchar', nullable: true })
    passwordResetToken?: string;

    @Column({ type: 'timestamp', nullable: true })
    passwordResetExpires?: Date;

    @Column({ type: 'boolean', default: true })
    notificationsEnabled!: boolean;

    @Column("text", { array: true, default: ['email'] })
    notificationChannels!: string[];

    @Column({ type: 'boolean', default: false })
    digestMode!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @OneToMany(() => HolidayProfile, profile => profile.user)
    profiles!: HolidayProfile[];

    @OneToMany(() => Alert, alert => alert.user)
    alerts!: Alert[];

    @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
    role!: UserRole;
}
