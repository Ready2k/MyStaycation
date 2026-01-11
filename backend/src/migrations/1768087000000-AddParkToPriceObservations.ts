import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParkToPriceObservations1768087000000 implements MigrationInterface {
    name = 'AddParkToPriceObservations1768087000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add park_id column to price_observations table
        await queryRunner.query(`ALTER TABLE "price_observations" ADD "park_id" uuid`);

        // Add foreign key constraint
        await queryRunner.query(`ALTER TABLE "price_observations" ADD CONSTRAINT "FK_price_observations_park" FOREIGN KEY ("park_id") REFERENCES "provider_parks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove foreign key constraint
        await queryRunner.query(`ALTER TABLE "price_observations" DROP CONSTRAINT "FK_price_observations_park"`);

        // Remove park_id column
        await queryRunner.query(`ALTER TABLE "price_observations" DROP COLUMN "park_id"`);
    }

}
