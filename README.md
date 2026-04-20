# Insighta Labs API - Natural Language Demographic Search

## Natural Language Parsing Approach

### Supported Keywords & Mappings

The parser uses **rule-based pattern matching** (no AI/LLMs) with the following logic:

#### Gender Detection
- **Male**: `male`, `males`, `man`, `men`, `boy`, `boys`
- **Female**: `female`, `females`, `woman`, `women`, `girl`, `girls`

#### Age Parsing (Priority Order)
1. **"young" keyword** → `min_age: 16, max_age: 24` (special mapping, not stored age_group)
2. **Explicit age groups**:
   - `child(ren)` → `age_group: child`
   - `teen(ager)s?` → `age_group: teenager`
   - `adult(s)?` → `age_group: adult`
   - `senior(s)|elderly|old` → `age_group: senior`
3. **Comparison operators**:
   - `above/over/older than X` → `min_age: X`
   - `below/under/younger than X` → `max_age: X`
4. **Ranges**: `X to Y` or `between X and Y` → `min_age: X, max_age: Y`

#### Country Detection
- Pattern: `from [country_name]`
- Supported: Nigeria(NG), Kenya(KE), Ghana(GH), South Africa(ZA), Angola(AO), Benin(BJ), Cameroon(CM), Ethiopia(ET)

#### Probability Confidence (Optional)
- `high confidence|very confident` → `min_gender_probability: 0.8, min_country_probability: 0.8`
- `medium confidence` → `min_gender_probability: 0.5, min_country_probability: 0.5`

### Parsing Logic Flow
1. Normalize query (lowercase, trim)
2. Apply regex patterns in priority order
3. Combine all detected filters
4. Return null if no filters detected → 422 error

## Limitations & Edge Cases

### Not Handled
- **Negation**: "not male", "excluding Nigeria"
- **Complex boolean logic**: "males OR females"
- **Implied ranges**: "middle-aged" (no standard definition)
- **Multiple countries**: "from Nigeria and Kenya"
- **Fuzzy matching**: typos or misspellings
- **Relative time**: "younger than me" or "older than average"
- **Compound queries**: "males under 30 from Nigeria with high confidence"

### Edge Cases
- "young adult" → maps to "young" (16-24) NOT adult group
- Overlapping constraints (e.g., "teenagers above 17") → both applied (min_age:17 + age_group:teenager)
- Empty query → returns 400 error
- Unrecognized country → returns 422
- Probability parsing only triggers on exact keyword matches

### Performance Considerations
- Database indexes on: gender, age, age_group, country_id, created_at, gender_probability
- Max limit enforced (50 records)
- Pagination prevents full table scans

## Deployment

### 1. Create environment file

Copy `.env.example` to `.env` and set your own PostgreSQL credentials:

```bash
cp .env.example .env
```

### 2. Ensure PostgreSQL user/database exist

If you get `password authentication failed` (error code `28P01`), create or update the DB user/password to match `.env`.

```sql
CREATE USER insighta_user WITH PASSWORD 'change_me';
CREATE DATABASE insighta_labs OWNER insighta_user;
GRANT ALL PRIVILEGES ON DATABASE insighta_labs TO insighta_user;
```

If the user already exists:

```sql
ALTER USER insighta_user WITH PASSWORD 'change_me';
```

### 3. Install and run

```bash
npm install
npm run seed  # Run once to populate database
npm start
```

### Health check

- `GET /health` returns `database: up|down` to show live DB connectivity state.