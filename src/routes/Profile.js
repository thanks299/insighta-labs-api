const { pool } = require('../config/database');

const VALID_SORT_COLUMNS = new Set(['age', 'created_at', 'gender_probability']);

function buildWhereClause(filters) {
  const conditions = ['1=1'];
  const values = [];
  let i = 1;

  if (filters.gender) {
    conditions.push(`gender = $${i++}`);
    values.push(filters.gender.toLowerCase());
  }
  if (filters.age_group) {
    conditions.push(`age_group = $${i++}`);
    values.push(filters.age_group.toLowerCase());
  }
  if (filters.country_id) {
    conditions.push(`country_id = $${i++}`);
    values.push(filters.country_id.toUpperCase());
  }
  // Use defined() check so min_age=0 works correctly
  if (filters.min_age !== undefined && filters.min_age !== null) {
    conditions.push(`age >= $${i++}`);
    values.push(Number(filters.min_age));
  }
  if (filters.max_age !== undefined && filters.max_age !== null) {
    conditions.push(`age <= $${i++}`);
    values.push(Number(filters.max_age));
  }
  if (filters.min_gender_probability !== undefined && filters.min_gender_probability !== null) {
    conditions.push(`gender_probability >= $${i++}`);
    values.push(Number(filters.min_gender_probability));
  }
  if (filters.min_country_probability !== undefined && filters.min_country_probability !== null) {
    conditions.push(`country_probability >= $${i++}`);
    values.push(Number(filters.min_country_probability));
  }

  return { where: conditions.join(' AND '), values, nextIndex: i };
}

function formatRow(row) {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    gender_probability: Number.parseFloat(row.gender_probability),
    age: row.age,
    age_group: row.age_group,
    country_id: row.country_id,
    country_name: row.country_name,
    country_probability: Number.parseFloat(row.country_probability),
    created_at: new Date(row.created_at).toISOString(),
  };
}

class Profile {
  static async findAll({ filters = {}, sort = {}, pagination = {} }) {
    const page = Math.max(1, Number.parseInt(pagination.page) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(pagination.limit) || 10));
    const offset = (page - 1) * limit;

    const sortCol = VALID_SORT_COLUMNS.has(sort.sort_by) ? sort.sort_by : 'created_at';
    const sortDir = (sort.order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const { where, values, nextIndex } = buildWhereClause(filters);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM profiles WHERE ${where}`,
      values
    );
    const total = Number.parseInt(countResult.rows[0].count);

    const dataValues = [...values, limit, offset];
    const dataResult = await pool.query(
      `SELECT * FROM profiles WHERE ${where}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
      dataValues
    );

    return {
      page,
      limit,
      total,
      data: dataResult.rows.map(formatRow),
    };
  }

  static async seedProfiles(profiles) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const p of profiles) {
        await client.query(
          `INSERT INTO profiles
             (id, name, gender, gender_probability, age, age_group,
              country_id, country_name, country_probability, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (name) DO NOTHING`,
          [
            p.id,
            typeof p.name === 'string' ? p.name.toLowerCase() : p.name,
            p.gender,
            p.gender_probability,
            p.age,
            p.age_group,
            p.country_id,
            p.country_name,
            p.country_probability,
            p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
          ]
        );
      }

      await client.query('COMMIT');
      console.log(`Seeded ${profiles.length} profiles`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = Profile;
