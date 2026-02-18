const express = require('express');
const zoneModel = require('../models/zone');

const router = express.Router();

// GET /api/zones
// Returns all active authorized zones as GeoJSON-like objects.
router.get('/', async (req, res) => {
  try {
    const zones = await zoneModel.listAll();
    res.json(zones);
  } catch (err) {
    console.error('Failed to list zones', err);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

module.exports = router;

