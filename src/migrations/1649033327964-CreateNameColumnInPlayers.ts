import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class CreateNameColumnInPlayers1649033327964
  implements MigrationInterface
{
  private tableName = 'players';
  private columnName = 'name';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      this.tableName,
      new TableColumn({
        name: this.columnName,
        type: 'varchar',
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(this.tableName, this.columnName);
  }
}
