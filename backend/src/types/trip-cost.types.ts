/**
 * Door-to-Duvet Engine Types
 * Based on MyStaycation 2026 Strategy
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TripCostRequest {
  originLatLng: LatLng;
  destinationLatLng: LatLng;
  stayNights: number;
  providerKey: string;
  engineType: 'PETROL' | 'EV';
  partySize: {
    adults: number;
    children: number;
  };
}

export interface OnParkSpendingConfig {
  providerKey: string;
  dailyBaseSpend: number;    // GBP
  activityMultiplier: number; 
  description: string;
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

/**
 * Extension for the User entity
 */
export interface UserTripConfig {
  homePostcode?: string;
  homeLatLng?: LatLng;
  engineType: 'PETROL' | 'EV';
}

/**
 * Extension for Search Results
 */
export interface SearchResultWithTripCost {
  // ... existing search result fields ...
  tripCost?: TripCost;
}
