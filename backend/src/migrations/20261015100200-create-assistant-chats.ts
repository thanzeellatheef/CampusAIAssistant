import { DataTypes, type QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('assistant_chats', {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      student_id: foreignKey('students'),
      course_id: foreignKey('courses'),
      academic_term_id: foreignKey('academic_terms'),
      title: { type: DataTypes.STRING(120), allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('assistant_chats', ['student_id', 'updated_at'], {
      name: 'assistant_chats_student_updated_index',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('assistant_chats');
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
