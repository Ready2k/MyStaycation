import React from 'react';
import { TripCost } from '../../types/trip-cost';

interface TripCostBreakdownProps {
  tripCost: TripCost;
}

/**
 * TripCostBreakdown
 * A premium UI component for displaying "Door-to-Duvet" total trip cost transparency.
 * Adheres to 2026 Strategy: Thumb-First (mobile) & Functional Minimalism (desktop).
 */
export const TripCostBreakdown: React.FC<TripCostBreakdownProps> = ({ tripCost }) => {
  return (
    <div className="group relative overflow-hidden bg-white/80 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 border border-gray-100 transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]">
      {/* Header with Smart Badge */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-gray-900 font-bold text-xl tracking-tight">Door-to-Duvet</h3>
          <p className="text-gray-400 text-xs mt-1 font-medium italic">Estimated total trip cost</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] uppercase tracking-widest text-green-600 bg-green-50 px-2.5 py-1 rounded-full font-bold">
            Best Value
          </span>
          {tripCost.isEstimate && (
            <span className="text-[10px] uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-bold">
              Rough Estimate
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Accommodation Row */}
        <div className="flex justify-between items-center group/row">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-lg transition-transform group-hover/row:scale-110">🏠</div>
            <div>
              <span className="block text-gray-900 font-semibold text-sm">Accommodation</span>
              <span className="block text-gray-400 text-[10px]">Base stay price</span>
            </div>
          </div>
          <span className="font-bold text-gray-900">£{tripCost.accommodationPriceGbp}</span>
        </div>

        {/* Travel & Fuel Row */}
        <div className="flex justify-between items-center group/row">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${tripCost.engineType === 'EV' ? 'bg-emerald-50' : 'bg-gray-50'} flex items-center justify-center text-lg transition-transform group-hover/row:scale-110`}>
              {tripCost.engineType === 'EV' ? '⚡' : '⛽'}
            </div>
            <div>
              <span className="block text-gray-900 font-semibold text-sm">
                Travel ({tripCost.distanceMiles} mi)
              </span>
              <span className="block text-gray-400 text-[10px]">
                {Math.floor(tripCost.drivingMinutes / 60)}h {Math.round(tripCost.drivingMinutes % 60)}m 
                {tripCost.engineType === 'EV' && <span className="ml-1 text-emerald-600 font-bold">· EV Optimized</span>}
              </span>
            </div>
          </div>
          <span className="font-bold text-gray-900">£{tripCost.fuelCostGbp.toFixed(2)}</span>
        </div>

        {/* Ferry / Island Tax */}
        {tripCost.ferryCostGbp > 0 && (
          <div className="flex justify-between items-center group/row animate-in fade-in slide-in-from-left-2 duration-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-lg transition-transform group-hover/row:scale-110">🚢</div>
              <div>
                <span className="block text-gray-900 font-semibold text-sm">Island Tax</span>
                <span className="block text-gray-400 text-[10px]">Ferry / Crossing fees</span>
              </div>
            </div>
            <span className="font-bold text-orange-600">£{tripCost.ferryCostGbp}</span>
          </div>
        )}

        {/* Spend Estimates */}
        <div className="flex justify-between items-center group/row">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-lg transition-transform group-hover/row:scale-110">🍕</div>
            <div>
              <span className="block text-gray-900 font-semibold text-sm">On-Park Spending</span>
              <span className="block text-gray-400 text-[10px]">Meals & activities estimate</span>
            </div>
          </div>
          <span className="font-bold text-gray-700">£{tripCost.onParkEstLow} – £{tripCost.onParkEstHigh}</span>
        </div>

        {/* Total Cost Section */}
        <div className="mt-8 pt-6 border-t border-dashed border-gray-100">
          <div className="flex justify-between items-end">
            <div>
              <span className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Total Trip Estimate</span>
              <span className="text-3xl font-black text-gray-900 tracking-tighter">
                £{tripCost.totalLow.toLocaleString()} <span className="text-gray-300 mx-1">—</span> £{tripCost.totalHigh.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Thumb-First Action Bar */}
      <div className="flex gap-3 mt-8">
        <button className="flex-[0.4] py-4 px-4 bg-gray-50 text-gray-500 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-gray-100 active:scale-[0.98] transition-all">
          Details
        </button>
        <button className="flex-1 py-4 px-4 bg-black text-white rounded-2xl text-sm font-bold shadow-lg shadow-black/10 hover:shadow-black/20 active:scale-[0.98] transition-all">
          Watch this Deal
        </button>
      </div>
    </div>
  );
};
