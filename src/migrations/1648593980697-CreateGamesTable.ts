import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class CreateGamesTable1648593980697 implements MigrationInterface {
  private tableName = 'games';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: this.tableName,
        columns: [
          new TableColumn({
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          }),
          new TableColumn({
            name: 'starts_at',
            type: 'timestamp',
            default: 'NOW()',
          }),
          new TableColumn({
            name: 'ends_at',
            type: 'timestamp',
            isNullable: false,
          }),
          new TableColumn({
            name: 'created_at',
            type: 'timestamp',
            default: 'NOW()',
          }),
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.tableName);
  }
}
