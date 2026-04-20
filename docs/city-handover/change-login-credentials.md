# How To Change Login Credentials

## Purpose

Update login usernames/passwords in the current app.

## Prerequisites

- Authentication is currently demo-style and hardcoded in [`src/routes/auth.js`](../../src/routes/auth.js).
- Users are defined in the `USERS` array (username, password, role).
- Login API is `POST /api/login`.

## Steps

1. Open `src/routes/auth.js`.
2. Locate:

```js
const USERS = [
  { username: 'staff', password: 'password', role: 'staff' },
  { username: 'admin', password: 'password', role: 'admin' },
  { username: 'viewer', password: 'password', role: 'viewer' },
];
```

3. Replace usernames, passwords, and roles as needed.
4. Save the file and restart the app.

## Verify

1. Open the dashboard login page.
2. Test each updated account.
3. Confirm old credentials no longer work.
4. Optionally verify API response includes the expected `user.role`.

## Troubleshooting

- **Login still accepts old credentials:** restart the server and clear browser autofill.
- **Login fails for all users:** check for syntax errors in `src/routes/auth.js`.
- **Unexpected role behavior:** verify each `role` value in `USERS` matches expected app behavior.

## Rollback

1. Revert `src/routes/auth.js` to the previous known-good version.
2. Restart the app.
3. Re-test login with the previous credentials.

## Security notes

- Do not commit real production passwords to version control.
- This hardcoded approach is suitable for demos/internal use only.
- For production handover, migrate to secure auth (hashed passwords, database-backed users, and session/JWT controls).
