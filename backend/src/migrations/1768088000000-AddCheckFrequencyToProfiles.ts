import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCheckFrequencyToProfiles1768088000000 implements MigrationInterface {
    name = 'AddCheckFrequencyToProfiles1768088000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "holiday_profiles" ADD "checkFrequencyHours" integer NOT NULL DEFAULT 48`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "holiday_profiles" DROP COLUMN "checkFrequencyHours"`);
    }
}
