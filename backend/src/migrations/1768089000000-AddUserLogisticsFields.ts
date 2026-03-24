import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserLogisticsFields1768089000000 implements MigrationInterface {
    name = 'AddUserLogisticsFields1768089000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new columns to users table
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "homePostcode" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "homeLatitude" decimal(10,7)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "homeLongitude" decimal(10,7)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "engineType" character varying NOT NULL DEFAULT 'PETROL'`);

        // Fix enum issue: invalid input value for enum fetch_runs_status_enum: "NO_RESULTS"
        // Note: IF NOT EXISTS is not supported for ADD VALUE in some Postgres versions, 
        // so we use a DO block for safety.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'fetch_runs_status_enum' AND e.enumlabel = 'NO_RESULTS') THEN
                    ALTER TYPE "fetch_runs_status_enum" ADD VALUE 'NO_RESULTS';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'fetch_runs_status_enum' AND e.enumlabel = 'INVALID_LOCATION') THEN
                    ALTER TYPE "fetch_runs_status_enum" ADD VALUE 'INVALID_LOCATION';
                END IF;
            END$$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove columns
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "engineType"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "homeLongitude"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "homeLatitude"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "homePostcode"`);
    }

}
