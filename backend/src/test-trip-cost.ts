import { TripCostService } from './services/trip-cost.service';
import { TripCostRequest } from './types/trip-cost.types';

async function verifyTripCost() {
  const service = TripCostService.getInstance();
  
  // Test 1: Standard Petrol Trip to Haven (Hafan y Môr area roughly)
  const petrolRequest: TripCostRequest = {
    originLatLng: { lat: 51.5074, lng: -0.1278 }, // London
    destinationLatLng: { lat: 52.9234, lng: -4.3721 }, // Pwllheli
    stayNights: 4,
    providerKey: 'haven',
    engineType: 'PETROL',
    partySize: { adults: 2, children: 2 }
  };
  
  console.log('--- Test 1: Petrol Trip ---');
  const petrolCost = await service.calculateTotalTripCost(petrolRequest);
  console.log(JSON.stringify(petrolCost, null, 2));

  // Test 2: EV Trip with Charging Buffer
  const evRequest: TripCostRequest = { ...petrolRequest, engineType: 'EV' };
  console.log('\n--- Test 2: EV Trip ---');
  const evCost = await service.calculateTotalTripCost(evRequest);
  console.log(JSON.stringify(evCost, null, 2));
  
  if (evCost.fuelCostGbp < petrolCost.fuelCostGbp) {
    console.log('✅ EV Fuel Cost is lower as expected.');
  }
  if (evCost.drivingMinutes > petrolCost.drivingMinutes) {
    console.log('✅ EV Driving Time includes buffer as expected.');
  }

  // Test 3: Island Tax (Isle of Wight)
  const islandRequest: TripCostRequest = {
    ...petrolRequest,
    destinationLatLng: { lat: 50.70, lng: -1.30 }, // Cowes area
  };
  console.log('\n--- Test 3: Island Tax (Isle of Wight) ---');
  const islandCost = await service.calculateTotalTripCost(islandRequest);
  console.log(JSON.stringify(islandCost, null, 2));
  
  if (islandCost.ferryCostGbp > 0) {
    console.log('✅ Ferry Cost applied correctly.');
  }
}

verifyTripCost().catch(console.error);
