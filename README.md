# UK Staycation Price & Deal Watcher

A personal assistant that monitors UK staycation prices and deals over time, alerting you only when booking conditions are meaningfully good.

## Features

- 🔍 **Price Monitoring**: Track prices for Hoseasons and Haven holidays
- 📊 **Historical Tracking**: Build price history to identify genuine deals
- 🎯 **Smart Alerts**: Get notified only when prices hit meaningful thresholds
- 📧 **Email Notifications**: Receive alerts via email (AWS SES)
- 🔐 **Secure Authentication**: Email verification and password reset
- 📱 **Mobile Friendly**: Responsive web interface accessible from any device

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- AWS SES credentials (optional, for email notifications)

### Installation

1. **Clone the repository**
   ```bash
   cd /Users/jamescregeen/MyStaycation/MyStaycation
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` and configure**:
   - Set a strong `JWT_SECRET` (minimum 32 characters)
   - Configure AWS SES credentials (or use SMTP)
   - Adjust other settings as needed

4. **Start the application**
   ```bash
   docker-compose up -d
   ```

5. **Run database seeds**
   ```bash
   docker-compose exec api npm run seed
   ```

6. **Access the application**
   - Web UI: http://localhost
   - API: http://localhost:4000
   - Health check: http://localhost:4000/health

## Usage

1. **Register an account** at http://localhost/auth/register
2. **Verify your email** (check console logs if SES not configured)
3. **Create a holiday profile** with your preferences
4. **Wait for monitoring** jobs to run (or trigger manually)
5. **Receive alerts** when good deals are found

## Architecture

- **Backend**: Node.js/TypeScript with Fastify
- **Database**: PostgreSQL with TypeORM
- **Queue**: Redis + BullMQ for background jobs
- **Frontend**: Next.js with responsive design
- **Proxy**: Nginx with rate limiting

## Development

### Backend Development
```bash
cd backend
npm install
npm run dev
```

### Frontend Development
```bash
cd web
npm install
npm run dev
```

### Run Tests
```bash
cd backend
npm test
```

## Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Production deployment instructions
- [API Documentation](./API.md) - API endpoints and usage
- [Provider Guide](./PROVIDER_GUIDE.md) - Adding new providers

## Security

- ✅ JWT authentication with secure token storage
- ✅ Password hashing with bcrypt
- ✅ Rate limiting on API endpoints
- ✅ CORS protection
- ✅ Security headers via Helmet.js
- ✅ Email verification required
- ✅ HTTPS support (configure in production)

## Compliance

This application:
- Respects robots.txt
- Uses respectful rate limiting (24-72h intervals)
- Identifies itself with User-Agent headers
- Logs all fetch operations for audit trail
- Does NOT auto-book or handle payments

**You are responsible for ensuring compliance with provider Terms of Service.**

## License

GNU Affero General Public License v3.0 - see LICENSE file

## Support

For issues or questions, please create an issue in the repository.
