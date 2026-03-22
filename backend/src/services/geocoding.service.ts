/**
 * GeocodingService — resolves UK park names to lat/lon via Nominatim (OpenStreetMap).
 *
 * Usage policy: https://operations.osmfoundation.org/policies/nominatim/
 *   - Max 1 request/second
 *   - Must send a descriptive User-Agent
 *   - No bulk geocoding without rate limiting
 */

import { AppDataSource } from '../config/database';
import { ProviderPark } from '../entities/ProviderPark';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'MyStaycation/1.0 (UK holiday price tracker)';
const RATE_LIMIT_MS = 1100; // slightly over 1 s to be safe

interface NominatimResult {
    lat: string;
    lon: string;
    display_name: string;
}

/**
 * Look up coordinates for a single place name in the UK.
 * Returns null if not found or the request fails.
 */
export async function geocodeUKPlace(name: string): Promise<{ latitude: number; longitude: number } | null> {
    const params = new URLSearchParams({
        q: `${name} UK`,
        format: 'json',
        limit: '1',
        countrycodes: 'gb',
    });

    try {
        const res = await fetch(`${NOMINATIM_URL}?${params}`, {
            headers: { 'User-Agent': USER_AGENT },
        });

        if (!res.ok) {
            console.warn(`[Geocoding] Nominatim returned ${res.status} for "${name}"`);
            return null;
        }

        const results: NominatimResult[] = await res.json();
        if (!results.length) return null;

        return {
            latitude: parseFloat(results[0].lat),
            longitude: parseFloat(results[0].lon),
        };
    } catch (err) {
        console.warn(`[Geocoding] Failed to geocode "${name}":`, err);
        return null;
    }
}

/**
 * Geocode a single ProviderPark and save the result.
 * Safe to call fire-and-forget — errors are logged, not thrown.
 */
export async function geocodePark(park: ProviderPark): Promise<void> {
    const query = park.region ? `${park.name} ${park.region}` : park.name;
    const coords = await geocodeUKPlace(query);

    if (!coords) {
        console.log(`[Geocoding] No result for park "${park.name}"`);
        return;
    }

    try {
        const repo = AppDataSource.getRepository(ProviderPark);
        await repo.update(park.id, { latitude: coords.latitude, longitude: coords.longitude });
        console.log(`[Geocoding] ✅ ${park.name} → ${coords.latitude}, ${coords.longitude}`);
    } catch (err) {
        console.error(`[Geocoding] Failed to save coords for "${park.name}":`, err);
    }
}

/**
 * Backfill coordinates for all parks that have no lat/lon.
 * Respects Nominatim's 1 req/s rate limit.
 * Returns counts of attempted / succeeded / failed.
 */
export async function geocodeAllMissingParks(): Promise<{ attempted: number; succeeded: number; failed: number }> {
    const repo = AppDataSource.getRepository(ProviderPark);

    const parks = await repo
        .createQueryBuilder('park')
        .where('park.latitude IS NULL OR park.longitude IS NULL')
        .getMany();

    console.log(`[Geocoding] Backfilling ${parks.length} parks without coordinates...`);

    let succeeded = 0;
    let failed = 0;

    for (const park of parks) {
        const query = park.region ? `${park.name} ${park.region}` : park.name;
        const coords = await geocodeUKPlace(query);

        if (coords) {
            try {
                await repo.update(park.id, { latitude: coords.latitude, longitude: coords.longitude });
                console.log(`[Geocoding] ✅ ${park.name} → ${coords.latitude}, ${coords.longitude}`);
                succeeded++;
            } catch {
                failed++;
            }
        } else {
            console.log(`[Geocoding] ❌ No result for "${park.name}"`);
            failed++;
        }

        // Respect Nominatim rate limit
        await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    }

    console.log(`[Geocoding] Done. ${succeeded}/${parks.length} succeeded, ${failed} failed.`);
    return { attempted: parks.length, succeeded, failed };
}
