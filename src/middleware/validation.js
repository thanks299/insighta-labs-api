const PROFILE_PARAMS = new Set([
  'gender', 'age_group', 'country_id', 'min_age', 'max_age',
  'min_gender_probability', 'min_country_probability',
  'sort_by', 'order', 'page', 'limit',
]);

const SEARCH_PARAMS = new Set(['q', 'page', 'limit']);

const isPositiveInt = (v) => /^\d+$/.test(String(v)) && parseInt(v, 10) > 0;
const isFloat01 = (v) => { const n = Number(v); return !isNaN(n) && n >= 0 && n <= 1; };
const isNumeric = (v) => v !== '' && !isNaN(Number(v));

function err(res, status, message) {
  return res.status(status).json({ status: 'error', message });
}

function validateQueryParams(req, res, next) {
  const isSearch = req.path.endsWith('/search');
  const allowed = isSearch ? SEARCH_PARAMS : PROFILE_PARAMS;

  // Unknown params
  for (const key of Object.keys(req.query)) {
    if (!allowed.has(key)) {
      return err(res, 400, 'Invalid query parameters');
    }
  }

  // Search route: only validate q presence
  if (isSearch) {
    normalizePagination(req.query);
    return next();
  }

  // Profile route validations
  const { gender, age_group, country_id, min_age, max_age,
          min_gender_probability, min_country_probability,
          sort_by, order } = req.query;

  if (gender && !['male', 'female'].includes(gender.toLowerCase()))
    return err(res, 422, 'Invalid gender value');

  if (age_group && !['child', 'teenager', 'adult', 'senior'].includes(age_group.toLowerCase()))
    return err(res, 422, 'Invalid age_group value');

  if (country_id && !/^[A-Za-z]{2}$/.test(country_id))
    return err(res, 422, 'Invalid country_id value');

  if (min_age !== undefined && !isNumeric(min_age))
    return err(res, 422, 'Invalid min_age value');

  if (max_age !== undefined && !isNumeric(max_age))
    return err(res, 422, 'Invalid max_age value');

  if (min_gender_probability !== undefined && !isFloat01(min_gender_probability))
    return err(res, 422, 'Invalid min_gender_probability value');

  if (min_country_probability !== undefined && !isFloat01(min_country_probability))
    return err(res, 422, 'Invalid min_country_probability value');

  if (sort_by && !['age', 'created_at', 'gender_probability'].includes(sort_by))
    return err(res, 422, 'Invalid sort_by value');

  if (order && !['asc', 'desc'].includes(order.toLowerCase()))
    return err(res, 422, 'Invalid order value');

  normalizePagination(req.query);
  return next();
}

function normalizePagination(query) {
  query.page  = isPositiveInt(query.page)  ? String(parseInt(query.page, 10))  : '1';
  query.limit = isPositiveInt(query.limit) ? String(parseInt(query.limit, 10)) : '10';
}

module.exports = { validateQueryParams };
