import { MigrationInterface, QueryRunner } from "typeorm";

export class AdminDashboard1767619133119 implements MigrationInterface {
    name = 'AdminDashboard1767619133119'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."system_logs_level_enum" AS ENUM('INFO', 'WARN', 'ERROR')`);
        await queryRunner.query(`CREATE TABLE "system_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "level" "public"."system_logs_level_enum" NOT NULL, "message" text NOT NULL, "source" character varying NOT NULL, "details" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_56861c4b9d16aa90259f4ce0a2c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a4d57d243d15a45c981aaab0e2" ON "system_logs" ("level") `);
        await queryRunner.query(`CREATE INDEX "IDX_8255879e189354927b5cd3186b" ON "system_logs" ("createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER'`);
        await queryRunner.query(`ALTER TABLE "deals" ALTER COLUMN "confidence" SET DEFAULT '0.5'`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "language" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "defaultCheckFrequencyHours" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "defaultCheckFrequencyHours" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "language" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "deals" ALTER COLUMN "confidence" SET DEFAULT 0.5`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8255879e189354927b5cd3186b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4d57d243d15a45c981aaab0e2"`);
        await queryRunner.query(`DROP TABLE "system_logs"`);
        await queryRunner.query(`DROP TYPE "public"."system_logs_level_enum"`);
    }

}
