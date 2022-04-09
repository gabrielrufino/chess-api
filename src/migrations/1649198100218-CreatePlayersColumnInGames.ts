import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class CreatePlayersColumnInGames1649198100218
  implements MigrationInterface
{
  private tableName = 'games';
  private whitePlayerIdColumn = 'white_player_id';
  private blackPlayerIdColumn = 'black_player_id';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns(this.tableName, [
      new TableColumn({
        name: this.whitePlayerIdColumn,
        type: 'integer',
        isNullable: false,
      }),
      new TableColumn({
        name: this.blackPlayerIdColumn,
        type: 'integer',
        isNullable: false,
      }),
    ]);

    await queryRunner.createForeignKeys(this.tableName, [
      new TableForeignKey({
        columnNames: [this.whitePlayerIdColumn],
        referencedColumnNames: ['id'],
        referencedTableName: 'players',
      }),
      new TableForeignKey({
        columnNames: [this.blackPlayerIdColumn],
        referencedColumnNames: ['id'],
        referencedTableName: 'players',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns(this.tableName, [
      this.whitePlayerIdColumn,
      this.blackPlayerIdColumn,
    ]);
  }
}
