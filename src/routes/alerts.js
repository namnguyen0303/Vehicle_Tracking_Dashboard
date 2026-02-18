const express = require('express');
const alertModel = require('../models/alert');

const router = express.Router();

// GET /api/alerts
// Returns recent alerts, newest first.
// Optional query param: ?limit=100
router.get('/', async (req, res) => {
  const limit = Number(req.query.limit || 50);

  try {
    const alerts = await alertModel.listRecent({ limit });
    res.json(alerts);
  } catch (err) {
    console.error('Failed to list alerts', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

module.exports = router;

