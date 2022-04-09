import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class CreateDeleteDateColumnInPlayers1649526343461
  implements MigrationInterface
{
  private tableName = 'players';
  private columnName = 'deleted_at';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      this.tableName,
      new TableColumn({
        name: this.columnName,
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(this.tableName, this.columnName);
  }
}
