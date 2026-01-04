# UK Staycation Watcher - Documentation

This directory contains all project documentation organized by category.

## 📁 Documentation Structure

### 🏗️ Architecture
Core system design and technical specifications:
- [`REQUIREMENTS.md`](architecture/REQUIREMENTS.md) - MVP requirements specification
- [`MVP_architecture.md`](architecture/MVP_architecture.md) - System architecture overview
- [`SERIES_KEY_IMPLEMENTATION.md`](architecture/SERIES_KEY_IMPLEMENTATION.md) - Series key system for price comparisons
- [`WATCHER_CAPABILITY_MAP.md`](architecture/WATCHER_CAPABILITY_MAP.md) - Feature capability mapping
- [`RealWorldMapping.md`](architecture/RealWorldMapping.md) - Real-world implementation mapping

### 🚀 Deployment
Production deployment guides and status:
- [`DEPLOYMENT.md`](deployment/DEPLOYMENT.md) - Complete deployment guide (AWS, local)
- [`SYNOLOGY_DEPLOYMENT.md`](deployment/SYNOLOGY_DEPLOYMENT.md) - Synology NAS deployment
- [`DOCKER_DEPLOYMENT_STATUS.md`](deployment/DOCKER_DEPLOYMENT_STATUS.md) - Docker deployment status
- [`DOCKER_TESTING_SESSION.md`](deployment/DOCKER_TESTING_SESSION.md) - Docker testing logs

### 💻 Development
Developer guides and implementation details:
- [`PROVIDER_GUIDE.md`](development/PROVIDER_GUIDE.md) - Adding new holiday providers
- [`LiveSearch.md`](development/LiveSearch.md) - Live search functionality
- [`ClarifyingQuestions_response.md`](development/ClarifyingQuestions_response.md) - Development Q&A
- [`tofu.md`](development/tofu.md) - Development notes

### 🧪 Testing
Testing guides and procedures:
- [`TESTING.md`](testing/TESTING.md) - Testing strategy and procedures
- [`LiveSearchTestActions.md`](testing/LiveSearchTestActions.md) - Live search testing

### 📊 Status & Progress
Project status and completion tracking:
- [`FIXES_COMPLETED.md`](status/FIXES_COMPLETED.md) - ✅ Completed fixes (100% done)
- [`FIXES_REQUIRED.md`](status/FIXES_REQUIRED.md) - Required fixes list
- [`STAGING_CHECKLIST.md`](status/STAGING_CHECKLIST.md) - Staging deployment checklist
- [`STAGING_STATUS.md`](status/STAGING_STATUS.md) - Current staging status

### 🔧 API Reference
- [`SEARCH_PREVIEW_API.md`](SEARCH_PREVIEW_API.md) - Search preview API documentation

### 📝 Other
- [`pitch.md`](pitch.md) - Project pitch and overview

## 🚀 Quick Start

1. **New to the project?** Start with [`pitch.md`](pitch.md) and [`REQUIREMENTS.md`](architecture/REQUIREMENTS.md)
2. **Setting up locally?** See [`DEPLOYMENT.md`](deployment/DEPLOYMENT.md)
3. **Adding providers?** Check [`PROVIDER_GUIDE.md`](development/PROVIDER_GUIDE.md)
4. **Production ready?** Review [`FIXES_COMPLETED.md`](status/FIXES_COMPLETED.md)
5. **Need quick reference?** See [`QUICK_REFERENCE.md`](QUICK_REFERENCE.md)

## 📋 Project Status

**Current Status**: ✅ **Production Ready**
- All critical fixes completed (100%)
- Docker containers running successfully
- Frontend and backend fully implemented
- Series-based price analysis operational
- Alert deduplication working

**Next Steps**: Configure email service (AWS SES) for full functionality.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js Web   │    │  Fastify API    │    │ Background Jobs │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Workers)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │     Redis       │
                       │   (Database)    │    │    (Queue)      │
                       └─────────────────┘    └─────────────────┘
```

## 🔗 External Links

- **Main README**: [`../README.md`](../README.md)
- **License**: [`../LICENSE`](../LICENSE)
- **Docker Compose**: [`../docker-compose.yml`](../docker-compose.yml)

---

*Last updated: January 2026*