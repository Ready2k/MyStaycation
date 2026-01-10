
import { AppDataSource } from '../src/config/database';
import { HolidayProfile } from '../src/entities/HolidayProfile';
import { SearchFingerprint } from '../src/entities/SearchFingerprint';
import { FetchRun } from '../src/entities/FetchRun';

async function run() {
    console.log('🚀 Checking Watcher Coverage & Status (via FetchRuns)...');

    try {
        await AppDataSource.initialize();
        console.log('✅ Database connected');

        const profileRepo = AppDataSource.getRepository(HolidayProfile);
        const paramsRepo = AppDataSource.getRepository(SearchFingerprint);
        const fetchRunRepo = AppDataSource.getRepository(FetchRun);

        // 1. Get all active profiles with their fingerprints
        const profiles = await profileRepo.find({
            where: { enabled: true }, // Note: Entity uses 'enabled' not 'isActive'
            relations: ['fingerprints'],
            order: { name: 'ASC' }
        });

        console.log(`\n📊 Found ${profiles.length} Active Watchers\n`);
        console.log('NAME'.padEnd(30) + ' | ' + 'REGION'.padEnd(20) + ' | ' + 'LAST RUN'.padEnd(25) + ' | ' + 'STATUS');
        console.log('-'.repeat(100));

        let staleCount = 0;
        const now = new Date();
        const STALE_THRESHOLD_HOURS = 24;

        for (const profile of profiles) {
            // Find latest FetchRun across all fingerprints for this profile
            let latestRun: Date | null = null;
            let runStatus = 'NEVER';

            if (profile.fingerprints && profile.fingerprints.length > 0) {
                const fingerprintIds = profile.fingerprints.map(f => f.id);

                const lastFetch = await fetchRunRepo.createQueryBuilder('run')
                    .where('run.fingerprint_id IN (:...ids)', { ids: fingerprintIds })
                    .orderBy('run.startedAt', 'DESC')
                    .getOne();

                if (lastFetch && lastFetch.startedAt) {
                    latestRun = lastFetch.startedAt;
                    runStatus = lastFetch.status;
                }
            }

            // Determine health
            let lastRunStr = 'NEVER';
            let isStale = false;
            let displayStatus = runStatus;

            if (latestRun) {
                lastRunStr = new Date(latestRun).toLocaleString();
                const diffHours = (now.getTime() - new Date(latestRun).getTime()) / (1000 * 60 * 60);

                if (diffHours > STALE_THRESHOLD_HOURS) {
                    isStale = true;
                    displayStatus += ' (STALE)';
                }
            } else {
                isStale = true; // Never ran is stale by definition
            }

            if (isStale) staleCount++;

            console.log(
                profile.name.substring(0, 29).padEnd(30) + ' | ' +
                (profile.region || 'N/A').substring(0, 19).padEnd(20) + ' | ' +
                lastRunStr.padEnd(25) + ' | ' +
                displayStatus
            );
        }

        console.log('-'.repeat(100));
        if (staleCount > 0) {
            console.log(`\n❌ WARNING: ${staleCount} watchers seem stale or inactive (No fetch in ${STALE_THRESHOLD_HOURS}h).`);
        } else {
            console.log('\n✅ All watchers appear active and scheduled.');
        }

    } catch (error) {
        console.error('❌ Error checking coverage:', error);
    } finally {
        await AppDataSource.destroy();
    }
}

run();
