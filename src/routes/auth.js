const express = require('express');

const router = express.Router();

// For now, we keep auth extremely simple:
// - Hard-coded staff user (username: staff, password: password)
// - Returns a dummy token on success
// This can later be swapped for a real auth system (JWT, OAuth, etc.).

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (username === 'staff' && password === 'password') {
    return res.json({
      success: true,
      token: 'demo-token',
      user: { username: 'staff', role: 'staff' },
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid credentials',
  });
});

module.exports = router;

