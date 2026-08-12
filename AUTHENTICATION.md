# Authentication

## Architecture

Authentication is implemented in the Node/Express backend and persisted in MongoDB through the existing Mongoose connection. The frontend uses an auth context, protected React routes, and credentialed API requests.

Sessions use a signed JWT stored in an HTTP-only cookie named `ptx_session`. The frontend does not store the token directly.

## MongoDB User Schema

The `User` model includes:

- `userId`
- `name`
- `email`
- `age`
- `passwordHash`
- `googleId`
- `authProvider`
- `initialBalance`
- `currentBalance`
- `wallet.cashBalance`
- `createdAt`
- `updatedAt`

`email` is unique and sparse. `googleId` is unique and sparse. Password hashes are excluded from normal query selection and are never returned by API responses.

## Login Flow

1. User submits email and password from `/login`.
2. Backend validates the email format.
3. Backend loads the user with `passwordHash` explicitly selected.
4. Password is checked with bcrypt.
5. Backend sets the HTTP-only session cookie.
6. Frontend redirects to `/dashboard`.

## Registration Flow

1. User submits name, age, email, password, confirmation, and selected balance from `/register`.
2. Backend validates all fields.
3. Initial balance must be one of `100000` through `1000000` in `100000` increments.
4. Password is hashed with bcrypt before storage.
5. `initialBalance`, `currentBalance`, and `wallet.cashBalance` are initialized to the selected amount.
6. A default per-user watchlist is created.
7. Backend sets the session cookie.

## Google OAuth Flow

Google sign-in starts at:

```text
GET /api/auth/google/start
```

The backend redirects to Google OAuth with OpenID Connect scopes. The callback exchanges the authorization code for Google tokens and verifies the returned identity with Google.

Existing Google-linked users are logged in immediately. First-time Google users are redirected to `/google-setup`, where age and initial paper balance are collected before the MongoDB user is created.

## JWT / Session Flow

- `GET /api/auth/me` restores the current session after refresh.
- `POST /api/auth/logout` clears the session cookie.
- Expired or invalid cookies are rejected and cleared.
- Private API routes use `requireAuth`.

## Protected Routes

Unauthenticated users can access:

- `/login`
- `/register`
- `/google-setup`

Authenticated users can access:

- `/dashboard`
- `/market`
- `/markets`
- `/trade`
- `/orderbook`
- `/orders`
- `/positions`
- `/portfolio`
- `/prediction`
- `/ai-analysis`
- `/settings`

## User-Data Isolation

The backend derives user ownership from `req.user.id`, which comes from the verified session cookie. The frontend no longer sends `user_id` for order placement.

Protected resources reject mismatched URL user IDs with `403 Forbidden`, including:

- User profile
- Orders
- Trades
- Positions
- Portfolio
- Watchlist
- Order cancellation

Order creation sends the authenticated user ID to the C++ matching engine while keeping authentication out of the engine itself.

## Required Environment Variables

Required for email/password sessions:

```text
JWT_SECRET
```

Optional session tuning:

```text
JWT_EXPIRES_IN
JWT_COOKIE_MAX_AGE_MS
COOKIE_SECURE
COOKIE_SAME_SITE
CORS_ORIGIN
FRONTEND_URL
BCRYPT_SALT_ROUNDS
```

Required for Google OAuth:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL
```

Existing MongoDB variables remain in use:

```text
MONGODB_URI
MONGODB_DB
MONGODB_ENABLED
MONGODB_CONNECT_TIMEOUT_MS
```

## Testing Checklist

1. Register a new user with `500000` initial balance and verify dashboard balance is `₹5,00,000`.
2. Confirm the database stores `passwordHash`, not plaintext `password`.
3. Log out and verify `/trade` redirects to `/login`.
4. Log in again and verify portfolio, orders, positions, watchlist, and balance load for the same account.
5. Place an order as User A.
6. Log in as User B and verify User A's orders, trades, positions, portfolio, and watchlist are not visible.
7. Attempt to call a User A URL while authenticated as User B and verify `403 Forbidden`.
8. Attempt unauthenticated private API requests and verify `401 Authentication required`.
9. Attempt to include a forged `user_id` in `POST /api/orders`; verify the created order belongs to the session user.
10. Configure Google OAuth variables and test existing-account login plus first-time `/google-setup`.

## Security Considerations

- Never log passwords, password hashes, JWTs, or OAuth tokens.
- Keep `JWT_SECRET` long, random, and private.
- Use HTTPS and `COOKIE_SECURE=true` in production.
- Keep Google OAuth credentials in `.env`; do not hard-code them.
- Market data endpoints can stay public, but trading and user-specific data must stay behind `requireAuth`.
