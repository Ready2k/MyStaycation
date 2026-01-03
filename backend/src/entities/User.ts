import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { HolidayProfile } from './HolidayProfile';
import { Alert } from './Alert';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ unique: true })
    email!: string;

    @Column()
    password!: string;

    @Column({ default: false })
    emailVerified!: boolean;

    @Column({ nullable: true })
    emailVerificationToken?: string;

    @Column({ nullable: true })
    passwordResetToken?: string;

    @Column({ nullable: true })
    passwordResetExpires?: Date;

    @Column({ default: true })
    notificationsEnabled!: boolean;

    @Column({ type: 'simple-array', default: '' })
    notificationChannels!: string[]; // ['email', 'push', 'sms']

    @Column({ default: false })
    digestMode!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @OneToMany(() => HolidayProfile, profile => profile.user)
    profiles!: HolidayProfile[];

    @OneToMany(() => Alert, alert => alert.user)
    alerts!: Alert[];
}
