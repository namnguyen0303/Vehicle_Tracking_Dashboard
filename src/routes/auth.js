const express = require('express');

const router = express.Router();

const USERS = [
  { username: 'staff', password: 'password', role: 'staff' },
  { username: 'admin', password: 'password', role: 'admin' },
  { username: 'viewer', password: 'password', role: 'viewer' },
];

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  const user = USERS.find((u) => u.username === username && u.password === password);

  if (user) {
    return res.json({
      success: true,
      token: 'demo-token',
      user: { username: user.username, role: user.role },
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid credentials',
  });
});

module.exports = router;
