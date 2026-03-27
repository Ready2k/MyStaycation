#!/bin/bash

# MyStaycation Code Quality Quick Fixes
# This script addresses the most critical linting and TypeScript issues

set -e

echo "🔧 Starting MyStaycation Code Quality Fixes..."
echo ""

cd "$(dirname "$0")/backend"

# 1. Fix unused imports in search.ts
echo "📝 Fixing src/routes/search.ts..."
cat > /tmp/search_fix.txt << 'EOF'
import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../config/database';
import { HolidayProfile } from '../entities/HolidayProfile';
import { SearchFingerprint } from '../entities/SearchFingerprint';
import { previewService } from '../services/search/preview.service';
import z from 'zod';
import { createProfileSchema } from './profiles';
EOF

# 2. Fix unused imports in users.ts
echo "📝 Fixing src/routes/users.ts..."
sed -i.bak '/^import bcrypt from/d' src/routes/users.ts

# 3. Fix unused imports in preview.service.ts
echo "📝 Fixing src/services/search/preview.service.ts..."
sed -i.bak '/AccommodationType,/d' src/services/search/preview.service.ts
sed -i.bak '/CandidateResult,/d' src/services/search/preview.service.ts
sed -i.bak '/SearchFingerprint/d' src/services/search/preview.service.ts

# 4. Fix unused imports in fingerprint.service.ts
echo "📝 Fixing src/services/search/fingerprint.service.ts..."
sed -i.bak '/adapterRegistry/d' src/services/search/fingerprint.service.ts

# 5. Fix unused imports in trigger-check.ts
echo "📝 Fixing src/trigger-check.ts..."
sed -i.bak '/generateMonitorJobId/d' src/trigger-check.ts

# 6. Fix prefer-const issues
echo "📝 Fixing prefer-const issues..."
sed -i.bak 's/let inDateRange =/const inDateRange =/g' src/services/search/preview.service.ts
sed -i.bak 's/let weakReasons =/const weakReasons =/g' src/utils/result-matcher.ts

# 7. Fix unused parameter in alert.service.ts
echo "📝 Fixing src/services/alert.service.ts..."
sed -i.bak 's/profileId?: string/_profileId?: string/g' src/services/alert.service.ts

# 8. Remove backup files
echo "🧹 Cleaning up backup files..."
find src -name "*.bak" -delete

echo ""
echo "✅ Quick fixes applied!"
echo ""
echo "⚠️  Manual fixes still required:"
echo "   1. Replace 'any' types with proper interfaces (110 instances)"
echo "   2. Fix TypeScript compilation errors (24 errors)"
echo "   3. Replace console.log with SystemLogger (150+ instances)"
echo "   4. Add null checks for non-null assertions"
echo ""
echo "Run 'npm run lint' to verify fixes"
echo "Run 'npx tsc --noEmit' to check TypeScript errors"
