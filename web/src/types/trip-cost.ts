/**
 * Door-to-Duvet Engine Types (Frontend)
 * Matches backend definitions in trip-cost.types.ts
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TripCost {
  // Travel Details
  distanceMiles: number;
  drivingMinutes: number;
  fuelCostGbp: number;
  ferryCostGbp: number;   // NEW: Island tax
  engineType: 'PETROL' | 'EV';

  // On-Park Spending Estimates
  onParkEstLow: number;
  onParkEstHigh: number;

  // Accommodation (Base Price)
  accommodationPriceGbp: number;

  // Totals
  totalLow: number;  // acc + fuel + ferry + onParkLow
  totalHigh: number; // acc + fuel + ferry + onParkHigh

  // Metadata
  calculatedAt: string; // ISO Date
  currency: 'GBP';
  isEstimate: boolean;
}
