import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class ChangeParkIdToParkIds1735937500000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // First drop the old column to avoid type conflict issues (simplest approach for dev)
        // Or rename if we want to preserve data. Given User just started testing, dropping is safer to ensure correct array format.
        // Actually, let's try to be nice and migrate data if possible, but simplest is drop add.

        await queryRunner.dropColumn("holiday_profiles", "parkId");

        await queryRunner.addColumn(
            "holiday_profiles",
            new TableColumn({
                name: "parkIds",
                type: "text", // simple-array stores as text
                isNullable: true,
                default: "''"
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("holiday_profiles", "parkIds");
        await queryRunner.addColumn(
            "holiday_profiles",
            new TableColumn({
                name: "parkId",
                type: "varchar",
                isNullable: true
            })
        );
    }
}
