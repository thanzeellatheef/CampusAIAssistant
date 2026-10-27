import { DataTypes, type QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('course_document_chunks', {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      document_id: foreignKey('course_documents'),
      chunk_index: { type: DataTypes.INTEGER, allowNull: false },
      page_number: { type: DataTypes.INTEGER, allowNull: true },
      content: { type: DataTypes.TEXT, allowNull: false },
      embedding: { type: DataTypes.JSON, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('course_document_chunks', {
      fields: ['document_id', 'chunk_index'],
      type: 'unique',
      name: 'course_document_chunk_index_unique',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('course_document_chunks');
  },
};

function foreignKey(table: string) {
  return {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: { model: table, key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  };
}
