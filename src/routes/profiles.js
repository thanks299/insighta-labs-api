const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { validateQueryParams } = require('../middleware/validation');

router.get('/profiles', validateQueryParams, profileController.getAllProfiles);
router.get('/profiles/search', validateQueryParams, profileController.searchNaturalLanguage);

module.exports = router;