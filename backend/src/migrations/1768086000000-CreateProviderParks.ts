import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProviderParks1768086000000 implements MigrationInterface {
    name = 'CreateProviderParks1768086000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "provider_parks" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "provider_id" uuid NOT NULL,
                "providerParkCode" character varying,
                "name" character varying NOT NULL,
                "region" character varying,
                "latitude" numeric(10,7),
                "longitude" numeric(10,7),
                CONSTRAINT "UQ_provider_parks_provider_code" UNIQUE ("provider_id", "providerParkCode"),
                CONSTRAINT "PK_provider_parks" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "provider_parks"
            ADD CONSTRAINT "FK_provider_parks_provider"
            FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_provider_parks_provider_id" ON "provider_parks" ("provider_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_provider_parks_provider_id"`);
        await queryRunner.query(`ALTER TABLE "provider_parks" DROP CONSTRAINT "FK_provider_parks_provider"`);
        await queryRunner.query(`DROP TABLE "provider_parks"`);
    }
}
