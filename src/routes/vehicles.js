const express = require('express');
const vehicleModel = require('../models/vehicle');

const router = express.Router();

// GET /api/vehicles
// Returns the latest known position and status for all vehicles.
router.get('/', async (req, res) => {
  try {
    const vehicles = await vehicleModel.listAll();
    res.json(vehicles);
  } catch (err) {
    console.error('Failed to list vehicles', err);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

module.exports = router;

