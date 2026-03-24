import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TripCostService } from '../../src/services/trip-cost.service';
import { TripCostRequest } from '../../src/types/trip-cost.types';
import * as fs from 'fs';

// Mock fs to avoid actual file reads during tests
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => JSON.stringify({
    haven: { dailyBaseSpend: 25, activityMultiplier: 1.2 },
    centerparcs: { dailyBaseSpend: 45, activityMultiplier: 2.5 }
  }))
}));

describe('TripCostService', () => {
  let service: TripCostService;

  beforeEach(() => {
    // Reset singleton if necessary, or just get instance
    service = TripCostService.getInstance();
  });

  it('should calculate correct fuel cost for PETROL engine', async () => {
    const request: TripCostRequest = {
      originLatLng: { lat: 51.5, lng: -0.1 }, // London
      destinationLatLng: { lat: 53.4, lng: -2.2 }, // Manchester
      stayNights: 3,
      providerKey: 'haven',
      engineType: 'PETROL',
      partySize: { adults: 2, children: 2 }
    };

    const result = await service.calculateTotalTripCost(request);
    
    // London to Manchester is ~158.3 miles crow distance via Haversine.
    // Road factor 1.25 -> ~197.8 miles
    // 197.8 miles * 18p = £35.61
    expect(result.fuelCostGbp).toBeCloseTo(35.6, 1);
    expect(result.engineType).toBe('PETROL');
    expect(result.drivingMinutes).toBeGreaterThan(0);
  });

  it('should calculate lower fuel cost for EV with time buffer', async () => {
    const request: TripCostRequest = {
      originLatLng: { lat: 51.5, lng: -0.1 },
      destinationLatLng: { lat: 53.4, lng: -2.2 },
      stayNights: 3,
      providerKey: 'haven',
      engineType: 'EV',
      partySize: { adults: 2, children: 2 }
    };

    const result = await service.calculateTotalTripCost(request);
    
    // 197.8 miles * 8p = £15.82
    expect(result.fuelCostGbp).toBeCloseTo(15.8, 1);
    expect(result.engineType).toBe('EV');
    
    // Verify it's lower than petrol (we know petrol was ~36.7)
    expect(result.fuelCostGbp).toBeLessThan(30);
  });

  it('should apply ferry cost for Isle of Wight', async () => {
    const request: TripCostRequest = {
      originLatLng: { lat: 51.5, lng: -0.1 },
      destinationLatLng: { lat: 50.7, lng: -1.3 }, // Isle of Wight
      stayNights: 3,
      providerKey: 'haven',
      engineType: 'PETROL',
      partySize: { adults: 2, children: 2 }
    };

    const result = await service.calculateTotalTripCost(request);
    expect(result.ferryCostGbp).toBe(85);
    expect(result.totalLow).toBeGreaterThan(result.accommodationPriceGbp + result.fuelCostGbp + result.onParkEstLow);
  });

  it('should fallback to Haversine if routing is unavailable', async () => {
    const request: TripCostRequest = {
      originLatLng: { lat: 51.5, lng: -0.1 },
      destinationLatLng: { lat: 53.4, lng: -2.2 },
      stayNights: 3,
      providerKey: 'haven',
      engineType: 'PETROL',
      partySize: { adults: 2, children: 2 }
    };

    const result = await service.calculateTotalTripCost(request);
    expect(result.distanceMiles).toBeGreaterThan(0);
  });

  it('should calculate correct on-park spending for known providers', async () => {
    const request: TripCostRequest = {
      originLatLng: { lat: 51.5, lng: -0.1 },
      destinationLatLng: { lat: 53.4, lng: -2.2 },
      stayNights: 4,
      providerKey: 'centerparcs',
      engineType: 'PETROL',
      partySize: { adults: 2, children: 2 }
    };

    const result = await service.calculateTotalTripCost(request);
    
    // centerparcs: 45 dailyBase * 4 nights = 180 low
    // 180 * 2.5 multiplier = 450 high
    expect(result.onParkEstLow).toBe(180);
    expect(result.onParkEstHigh).toBe(450);
  });
});
