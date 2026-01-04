# Docker Testing Session - 2026-01-03

## Summary

Successfully resolved Docker architecture compatibility issues and got the application running in containers.

## Issues Encountered

### 1. bcrypt Architecture Mismatch
**Problem**: bcrypt native module was compiled for ARM (Mac M-series) but Docker needed x86_64 binaries.

**Root Cause**: Dockerfile was copying source code AFTER `npm install`, which overwrote freshly compiled x86_64 binaries with host's ARM binaries.

**Solution**:
- Created `.dockerignore` files to exclude `node_modules` and `dist` from Docker context
- Reordered Dockerfile steps to `COPY . .` BEFORE `npm install`
- This ensures npm compiles native modules inside the container for correct architecture

### 2. TypeORM Column Type Errors
**Problem**: Multiple entities had `@Column()` decorators without explicit type definitions, causing TypeORM to fail.

**Solution**: Added explicit column types to all entities:
- User: email, passwordHash, name, etc. → `varchar`
- Alert: dedupeKey → `varchar`
- Insight: dedupeKey, seriesKey → `varchar`
- PriceObservation: seriesKey → `varchar`
- HolidayProfile: name, enabled → `varchar`, `boolean`
- ProviderPark: providerParkCode, name, region → `varchar`
- Provider: code, name, baseUrl, enabled → `varchar`, `boolean`
- ProviderAccomType: providerAccomCode, name → `varchar`
- Deal: sourceRef, title, voucherCode → `varchar`

### 3. Database Name Mismatch
**Problem**: Application looked for database "staycation" but environment had "staycation_db".

**Solution**: Updated `.env` to use `POSTGRES_DB=staycation`.

## Final Status

✅ **Working Containers**:
- postgres: Healthy
- redis: Healthy
- web: Running on port 3000
- monitoring: Running (automated tasks)
- api: Ready to test (pending final verification)
- worker: Ready to test (pending final verification)

## Key Files Modified

- `backend/Dockerfile` - Fixed build order
- `web/Dockerfile` - Fixed build order
- `backend/.dockerignore` - Exclude node_modules
- `web/.dockerignore` - Exclude node_modules
- `docker-compose.yml` - Removed volume mounts for node_modules
- All entity files - Added explicit TypeORM column types

## Next Steps

1. Verify API health endpoint responds
2. Run database migrations
3. Test worker job processing
4. Verify monitoring container tasks
5. Begin staging soak test

## Lessons Learned

1. **Docker Build Order Matters**: Always copy source before installing dependencies when dealing with native modules
2. **Use .dockerignore**: Essential for excluding host-specific build artifacts
3. **TypeORM Strict Mode**: Always specify explicit column types in production code
4. **Multi-platform Builds**: Use `--platform=linux/amd64` for Synology/x86_64 compatibility
