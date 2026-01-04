# Manual Testing Checklist

## Pre-Testing Setup

- [ ] Copy `.env.example` to `.env`
- [ ] Set `JWT_SECRET` to a random 32+ character string
- [ ] Configure database credentials (or use defaults)
- [ ] (Optional) Configure AWS SES credentials for email testing

## Docker Setup

- [ ] Run `docker-compose up -d`
- [ ] Verify all containers are running: `docker-compose ps`
- [ ] Check logs for errors: `docker-compose logs`
- [ ] Run database seeds: `docker-compose exec api npm run seed`

## API Health Check

- [ ] Visit http://localhost:4000/health
- [ ] Should return: `{"status":"ok","timestamp":"..."}`

## User Registration

- [ ] Navigate to http://localhost
- [ ] Click "Get Started"
- [ ] Fill in email and password (min 8 characters)
- [ ] Submit registration form
- [ ] Check API logs for verification email: `docker-compose logs api | grep "Email"`
- [ ] If SES configured, check email inbox
- [ ] If SES not configured, copy verification token from logs

## Email Verification

- [ ] Click verification link from email OR
- [ ] Make POST request to `/api/auth/verify-email` with token
- [ ] Should receive success message

## Login

- [ ] Navigate to http://localhost/auth/login
- [ ] Enter registered email and password
- [ ] Should redirect to dashboard (or show success)
- [ ] Verify JWT token is stored (check browser localStorage/cookies)

## Database Verification

- [ ] Connect to database: `docker-compose exec postgres psql -U staycation -d staycation_db`
- [ ] Check users table: `SELECT * FROM users;`
- [ ] Verify user exists with `email_verified = true`
- [ ] Check providers table: `SELECT * FROM providers;`
- [ ] Should see Hoseasons and Haven

## Provider Adapters (Manual Test)

⚠️ **Use sparingly to avoid being blocked**

- [ ] Check robots.txt compliance
- [ ] Test Hoseasons adapter with sample search
- [ ] Test Haven adapter with sample search
- [ ] Verify HTML parsing extracts prices correctly

## Monitoring Job (Manual Trigger)

Note: Automated scheduling not yet implemented in this MVP

- [ ] Create a test fingerprint in database
- [ ] Manually trigger monitor job via API or direct queue
- [ ] Check worker logs: `docker-compose logs worker`
- [ ] Verify `fetch_runs` table has new entry
- [ ] Verify `price_observations` table has new records

## Insight Generation

- [ ] Add multiple price observations (manually or via monitoring)
- [ ] Run insight generation (via API or script)
- [ ] Check `insights` table for generated insights
- [ ] Verify insight types (LOWEST_IN_X_DAYS, PRICE_DROP_PERCENT, etc.)

## Alert System

- [ ] Create alert for a generated insight
- [ ] Check `alerts` table
- [ ] Verify alert status is QUEUED or SENT
- [ ] If SES configured, check email inbox
- [ ] If not, check API logs for email content

## Security Tests

- [ ] Attempt to access protected route without token → Should return 401
- [ ] Attempt rapid requests → Should be rate limited
- [ ] Check response headers for security headers (HSTS, CSP, etc.)
- [ ] Verify passwords are hashed in database (not plaintext)

## Mobile Responsiveness

- [ ] Access http://localhost from mobile device on same network
- [ ] Verify layout is responsive
- [ ] Test registration and login flows
- [ ] Check that all buttons and forms are usable

## Error Handling

- [ ] Try registering with existing email → Should show error
- [ ] Try logging in with wrong password → Should show error
- [ ] Try verifying with invalid token → Should show error
- [ ] Try resetting password with non-existent email → Should not reveal user existence

## Cleanup

- [ ] Stop containers: `docker-compose down`
- [ ] (Optional) Remove volumes: `docker-compose down -v`

## Issues Found

Document any issues discovered during testing:

1. 
2. 
3. 

## Test Results

- Date tested: ___________
- Tester: ___________
- Overall status: [ ] Pass [ ] Fail [ ] Partial
- Notes:
