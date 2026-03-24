import { TripCost, TripCostRequest, OnParkSpendingConfig } from '../types/trip-cost.types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * TripCostService
 * Responsible for calculating total staycation costs including fuel and on-park spending.
 * Optimized for 2026 Strategy: EV-awareness, Island Tax (Ferry), and robust fallback routing.
 */
export class TripCostService {
  private static instance: TripCostService;
  private onParkSpendingData: Record<string, any> = {};
  
  // Fuel Config (Pence Per Mile) - Defaults from Strategy 2026
  private readonly FUEL_PPM_PETROL = Number(process.env.FUEL_PPM_PETROL) || 18;
  private readonly FUEL_PPM_EV = Number(process.env.FUEL_PPM_EV) || 8;
  private readonly EV_CHARGING_BUFFER = 1.05; // 5% time buffer for charging stops

  // Ferry Lookup (Simple postcode/region based lookup for "Island Tax")
  private readonly FERRY_ROUTES: Record<string, number> = {
    'PO30': 85, // Isle of Wight (Cowes/Fishbourne)
    'PO31': 85,
    'PO33': 85,
    'PA75': 120, // Mull
    'IV51': 150, // Skye
    'TR21': 200, // Scilly Isles
    'PH41': 130, // Mallaig (Ferry to Skye/Isles)
  };

  private constructor() {
    this.loadSpendingData();
  }

  private loadSpendingData() {
    try {
      const configPath = path.join(__dirname, '../config/on-park-spending.json');
      if (fs.existsSync(configPath)) {
        this.onParkSpendingData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
    } catch (error) {
      // In production, we'd log this to a proper monitoring system
      console.error('[TripCostService] Failed to load on-park spending data:', error);
    }
  }

  public static getInstance(): TripCostService {
    if (!TripCostService.instance) {
      TripCostService.instance = new TripCostService();
    }
    return TripCostService.instance;
  }

  /**
   * Calculates the estimated total trip cost based on origin, destination and provider.
   */
  public async calculateTotalTripCost(request: TripCostRequest): Promise<TripCost> {
    const { distanceMiles, drivingMinutes, isEstimate } = await this.calculateTravelDistance(
      request.originLatLng,
      request.destinationLatLng
    );

    // Fuel Calculation (Pence to Pounds)
    const ppm = request.engineType === 'EV' ? this.FUEL_PPM_EV : this.FUEL_PPM_PETROL;
    const fuelCostGbp = (distanceMiles * ppm) / 100;

    // Time Buffer for EV (Charging stops)
    const finalMinutes = request.engineType === 'EV' ? drivingMinutes * this.EV_CHARGING_BUFFER : drivingMinutes;

    // Ferry Calculation (Island Tax)
    const ferryCostGbp = this.getFerryEstimate(request.destinationLatLng);

    // On-Park Spending (Aggregated low/high estimates)
    const { low: onParkLow, high: onParkHigh } = this.getOnParkSpendingEstimate(
      request.providerKey,
      request.stayNights
    );

    // Accommodation Price (Placeholder - actual implementation would fetch from SearchResult)
    const accommodationPriceGbp = request.stayNights * 125; // Average £125/night

    return {
      distanceMiles: Math.round(distanceMiles),
      drivingMinutes: Math.round(finalMinutes),
      fuelCostGbp: Number(fuelCostGbp.toFixed(2)),
      ferryCostGbp,
      engineType: request.engineType,
      onParkEstLow: Math.round(onParkLow),
      onParkEstHigh: Math.round(onParkHigh),
      accommodationPriceGbp,
      totalLow: Number((accommodationPriceGbp + fuelCostGbp + ferryCostGbp + onParkLow).toFixed(2)),
      totalHigh: Number((accommodationPriceGbp + fuelCostGbp + ferryCostGbp + onParkHigh).toFixed(2)),
      calculatedAt: new Date().toISOString(),
      currency: 'GBP',
      isEstimate
    };
  }

  /**
   * Calculates travel distance and time with robust multi-provider fallback.
   * Priority: OSRM (Self-hosted/Free) -> Mapbox (Fallback) -> Haversine (Emergency)
   */
  private async calculateTravelDistance(origin: any, destination: any): Promise<{ distanceMiles: number; drivingMinutes: number; isEstimate: boolean }> {
    // 1. OSRM Logic
    try {
      if (process.env.OSRM_URL) {
        // Implementation for OSRM URL fetch would go here
        // const response = await fetch(`${process.env.OSRM_URL}/route/v1/driving/...`)
      }
      // Simulating failure to trigger the fallback logic as per requirements
      throw new Error('OSRM_NOT_CONFIGURED');
    } catch (err) {
      // 2. Mapbox Logic
      try {
        if (process.env.MAPBOX_ACCESS_TOKEN) {
          // Implementation for Mapbox Directions API would go here
        }
        throw new Error('MAPBOX_NOT_CONFIGURED');
      } catch (mapboxErr) {
        // 3. Final Fallback: Haversine distance ("As the crow flies") + 25% road-winding factor
        const crowdMiles = this.calculateHaversineDistance(
          origin.lat, origin.lng,
          destination.lat, destination.lng
        );
        
        const roadMiles = crowdMiles * 1.25; // 25% added for UK road winding
        const roadMinutes = (roadMiles / 45) * 60; // Assume 45mph average speed for mixed UK roads

        return {
          distanceMiles: roadMiles,
          drivingMinutes: roadMinutes,
          isEstimate: true
        };
      }
    }
  }

  /**
   * Haversine formula to find the distance between two points in miles.
   */
  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Radius of the Earth in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Identifies if a destination is on an island and returns the estimated ferry cost.
   */
  private getFerryEstimate(destination: any): number {
    // In production, we'd use a reverse-geocoding service to get the postcode or a GeoJSON polygon check.
    // For this implementation, we check rough bounding boxes of known UK island destinations.
    
    // Isle of Wight bounding box
    if (destination.lat < 50.8 && destination.lat > 50.5 && destination.lng < -1.0 && destination.lng > -1.6) {
      return this.FERRY_ROUTES['PO30'];
    }
    
    // Skye area
    if (destination.lat < 57.7 && destination.lat > 57.0 && destination.lng < -5.7 && destination.lng > -6.8) {
      return this.FERRY_ROUTES['IV51'];
    }

    return 0;
  }

  /**
   * Aggregates on-park spending estimates based on provider configuration.
   */
  private getOnParkSpendingEstimate(providerKey: string, stayNights: number): { low: number; high: number } {
    const config = this.onParkSpendingData[providerKey] || { dailyBaseSpend: 25, activityMultiplier: 1.2 };
    
    const baseTotal = config.dailyBaseSpend * stayNights;
    return {
      low: baseTotal,
      high: baseTotal * config.activityMultiplier
    };
  }
}
