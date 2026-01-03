import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddParkIdToProfile1735937000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "holiday_profiles",
            new TableColumn({
                name: "parkId",
                type: "varchar",
                isNullable: true
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("holiday_profiles", "parkId");
    }
}
