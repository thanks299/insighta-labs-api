const Profile = require('../models/Profile');
const QueryParser = require('../services/QueryParser');

exports.getAllProfiles = async (req, res) => {
  try {
    const {
      gender, age_group, country_id,
      min_age, max_age, min_gender_probability, min_country_probability,
      sort_by, order,
      page = 1, limit = 10,
    } = req.query;

    const filters = {};
    if (gender)                   filters.gender = gender;
    if (age_group)                filters.age_group = age_group;
    if (country_id)               filters.country_id = country_id;
    if (min_age !== undefined)    filters.min_age = Number(min_age);
    if (max_age !== undefined)    filters.max_age = Number(max_age);
    if (min_gender_probability !== undefined)
      filters.min_gender_probability = Number(min_gender_probability);
    if (min_country_probability !== undefined)
      filters.min_country_probability = Number(min_country_probability);

    const result = await Profile.findAll({
      filters,
      sort: { sort_by, order },
      pagination: { page, limit },
    });

    return res.json({
      status: 'success',
      page: result.page,
      limit: result.limit,
      total: result.total,
      data: result.data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

exports.searchNaturalLanguage = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ status: 'error', message: 'Missing or empty query parameter' });
    }

    const filters = QueryParser.parse(q);

    if (!filters) {
      return res.status(422).json({ status: 'error', message: 'Unable to interpret query' });
    }

    const result = await Profile.findAll({
      filters,
      sort: {},
      pagination: { page, limit },
    });

    return res.json({
      status: 'success',
      page: result.page,
      limit: result.limit,
      total: result.total,
      data: result.data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};
