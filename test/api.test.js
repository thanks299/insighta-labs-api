const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');

describe('Insighta Labs API Tests', () => {
  beforeAll(async () => {
    // Create test tables and seed test data
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
        gender_probability FLOAT NOT NULL,
        age INT NOT NULL,
        age_group VARCHAR(20) NOT NULL,
        country_id VARCHAR(2) NOT NULL,
        country_name VARCHAR(100) NOT NULL,
        country_probability FLOAT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert test data
    const testProfiles = [
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'john doe',
        gender: 'male',
        gender_probability: 0.95,
        age: 25,
        age_group: 'adult',
        country_id: 'NG',
        country_name: 'Nigeria',
        country_probability: 0.9,
        created_at: '2026-04-01T12:00:00Z'
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'jane smith',
        gender: 'female',
        gender_probability: 0.88,
        age: 17,
        age_group: 'teenager',
        country_id: 'KE',
        country_name: 'Kenya',
        country_probability: 0.85,
        created_at: '2026-04-02T12:00:00Z'
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174003',
        name: 'bob johnson',
        gender: 'male',
        gender_probability: 0.92,
        age: 35,
        age_group: 'adult',
        country_id: 'NG',
        country_name: 'Nigeria',
        country_probability: 0.87,
        created_at: '2026-04-03T12:00:00Z'
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174004',
        name: 'alice williams',
        gender: 'female',
        gender_probability: 0.91,
        age: 8,
        age_group: 'child',
        country_id: 'GH',
        country_name: 'Ghana',
        country_probability: 0.82,
        created_at: '2026-04-04T12:00:00Z'
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174005',
        name: 'charlie brown',
        gender: 'male',
        gender_probability: 0.89,
        age: 70,
        age_group: 'senior',
        country_id: 'ZA',
        country_name: 'South Africa',
        country_probability: 0.88,
        created_at: '2026-04-05T12:00:00Z'
      }
    ];

    for (const profile of testProfiles) {
      await pool.query(
        `INSERT INTO profiles (id, name, gender, gender_probability, age, age_group, 
         country_id, country_name, country_probability, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (name) DO NOTHING`,
        Object.values(profile)
      );
    }
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS profiles');
    await pool.end();
  });

  describe('GET /api/profiles - Filtering', () => {
    test('should return all profiles with default pagination', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter by gender', async () => {
      const response = await request(app)
        .get('/api/profiles?gender=male')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => p.gender === 'male')).toBe(true);
    });

    test('should filter by age_group', async () => {
      const response = await request(app)
        .get('/api/profiles?age_group=adult')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => p.age_group === 'adult')).toBe(true);
    });

    test('should filter by country_id', async () => {
      const response = await request(app)
        .get('/api/profiles?country_id=NG')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => p.country_id === 'NG')).toBe(true);
    });

    test('should filter by min_age', async () => {
      const response = await request(app)
        .get('/api/profiles?min_age=30')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => p.age >= 30)).toBe(true);
    });

    test('should filter by max_age', async () => {
      const response = await request(app)
        .get('/api/profiles?max_age=20')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => p.age <= 20)).toBe(true);
    });

    test('should filter by age range', async () => {
      const response = await request(app)
        .get('/api/profiles?min_age=20&max_age=40')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => p.age >= 20 && p.age <= 40)).toBe(true);
    });

    test('should filter by min_gender_probability', async () => {
      const response = await request(app)
        .get('/api/profiles?min_gender_probability=0.9')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => p.gender_probability >= 0.9)).toBe(true);
    });

    test('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/profiles?gender=male&country_id=NG&min_age=25')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => 
        p.gender === 'male' && p.country_id === 'NG' && p.age >= 25
      )).toBe(true);
    });
  });

  describe('GET /api/profiles - Sorting', () => {
    test('should sort by age ascending', async () => {
      const response = await request(app)
        .get('/api/profiles?sort_by=age&order=asc')
        .expect(200);

      const ages = response.body.data.map(p => p.age);
      const sortedAges = [...ages].sort((a, b) => a - b);
      expect(ages).toEqual(sortedAges);
    });

    test('should sort by age descending', async () => {
      const response = await request(app)
        .get('/api/profiles?sort_by=age&order=desc')
        .expect(200);

      const ages = response.body.data.map(p => p.age);
      const sortedAges = [...ages].sort((a, b) => b - a);
      expect(ages).toEqual(sortedAges);
    });

    test('should sort by gender_probability', async () => {
      const response = await request(app)
        .get('/api/profiles?sort_by=gender_probability&order=desc')
        .expect(200);

      const probs = response.body.data.map(p => p.gender_probability);
      const sortedProbs = [...probs].sort((a, b) => b - a);
      expect(probs).toEqual(sortedProbs);
    });

    test('should default to created_at sorting', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .expect(200);

      expect(response.body.status).toBe('success');
    });
  });

  describe('GET /api/profiles - Pagination', () => {
    test('should respect page and limit parameters', async () => {
      const response = await request(app)
        .get('/api/profiles?page=1&limit=2')
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    test('should cap limit at maximum 50', async () => {
      const response = await request(app)
        .get('/api/profiles?limit=100')
        .expect(200);

      expect(response.body.limit).toBe(50);
    });

    test('should return correct total count', async () => {
      const response = await request(app)
        .get('/api/profiles?page=1&limit=2')
        .expect(200);

      expect(response.body.total).toBeDefined();
      expect(typeof response.body.total).toBe('number');
    });

    test('should handle page 2 correctly', async () => {
      const page1 = await request(app).get('/api/profiles?page=1&limit=2');
      const page2 = await request(app).get('/api/profiles?page=2&limit=2');

      expect(page1.body.data[0].id).not.toBe(page2.body.data[0]?.id);
    });
  });

  describe('GET /api/profiles/search - Natural Language', () => {
    test('should parse "young males from nigeria"', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=young males from nigeria')
        .expect(200);

      expect(response.body.status).toBe('success');
      // Should filter: gender=male, age between 16-24, country=NG
      expect(response.body.data.every(p => 
        p.gender === 'male' && p.age >= 16 && p.age <= 24 && p.country_id === 'NG'
      )).toBe(true);
    });

    test('should parse "females above 30"', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=females above 30')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => 
        p.gender === 'female' && p.age >= 30
      )).toBe(true);
    });

    test('should parse "people from angola"', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=people from angola')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => p.country_id === 'AO')).toBe(true);
    });

    test('should parse "adult males from kenya"', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=adult males from kenya')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => 
        p.gender === 'male' && p.age_group === 'adult' && p.country_id === 'KE'
      )).toBe(true);
    });

    test('should parse "teenagers"', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=teenagers')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => p.age_group === 'teenager')).toBe(true);
    });

    test('should parse "seniors"', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=seniors')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => p.age_group === 'senior')).toBe(true);
    });

    test('should parse "children"', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=children')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => p.age_group === 'child')).toBe(true);
    });

    test('should handle queries with pagination', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=males&page=1&limit=2')
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    test('should return 422 for uninterpretable query', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=purple elephants flying')
        .expect(422);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Unable to interpret query');
    });

    test('should return 400 for empty query', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Missing or empty query parameter');
    });

    test('should parse "male and female teenagers above 17"', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=male and female teenagers above 17')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.every(p => 
        (p.gender === 'male' || p.gender === 'female') && 
        p.age_group === 'teenager' && 
        p.age >= 17
      )).toBe(true);
    });

    test('should parse "high confidence predictions"', async () => {
      const response = await request(app)
        .get('/api/profiles/search?q=high confidence predictions')
        .expect(200);

      expect(response.body.status).toBe('success');
      // This should filter by probability thresholds
    });
  });

  describe('Error Handling', () => {
    test('should return 400 for invalid query parameters', async () => {
      const response = await request(app)
        .get('/api/profiles?invalid_param=123')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Invalid query parameters');
    });

    test('should return 422 for invalid gender value', async () => {
      const response = await request(app)
        .get('/api/profiles?gender=invalid')
        .expect(422);

      expect(response.body).toHaveProperty('status', 'error');
    });

    test('should return 422 for invalid age_group value', async () => {
      const response = await request(app)
        .get('/api/profiles?age_group=invalid')
        .expect(422);

      expect(response.body).toHaveProperty('status', 'error');
    });

    test('should return 404 for non-existent endpoint', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
    });

    test('should handle negative page numbers gracefully', async () => {
      const response = await request(app)
        .get('/api/profiles?page=-1')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.page).toBe(1); // Should default to 1
    });
  });

  describe('CORS Headers', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('Response Structure', () => {
    test('should have correct response structure for profiles endpoint', async () => {
      const response = await request(app)
        .get('/api/profiles?limit=1')
        .expect(200);

      expect(response.body).toEqual({
        status: expect.any(String),
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        data: expect.any(Array)
      });

      if (response.body.data.length > 0) {
        const profile = response.body.data[0];
        expect(profile).toHaveProperty('id');
        expect(profile).toHaveProperty('name');
        expect(profile).toHaveProperty('gender');
        expect(profile).toHaveProperty('gender_probability');
        expect(profile).toHaveProperty('age');
        expect(profile).toHaveProperty('age_group');
        expect(profile).toHaveProperty('country_id');
        expect(profile).toHaveProperty('country_name');
        expect(profile).toHaveProperty('country_probability');
        expect(profile).toHaveProperty('created_at');
      }
    });
  });
});