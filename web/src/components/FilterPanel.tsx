'use client';

import { X } from 'lucide-react';

interface FilterPanelProps {
    // Available filter options
    locations: string[];
    facilities: string[];
    accommodationTypes: string[];

    // Selected filters
    selectedLocations: Set<string>;
    selectedFacilities: Set<string>;
    selectedAccommodationTypes: Set<string>;

    // Filter handlers
    onLocationToggle: (location: string) => void;
    onFacilityToggle: (facility: string) => void;
    onAccommodationTypeToggle: (type: string) => void;
    onClearAll: () => void;
}

export function FilterPanel({
    locations,
    facilities,
    accommodationTypes,
    selectedLocations,
    selectedFacilities,
    selectedAccommodationTypes,
    onLocationToggle,
    onFacilityToggle,
    onAccommodationTypeToggle,
    onClearAll,
}: FilterPanelProps) {
    const hasActiveFilters = selectedLocations.size > 0 || selectedFacilities.size > 0 || selectedAccommodationTypes.size > 0;

    if (locations.length === 0 && facilities.length === 0 && accommodationTypes.length === 0) {
        return null;
    }

    return (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">Filters</h4>
                {hasActiveFilters && (
                    <button
                        onClick={onClearAll}
                        className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
                    >
                        <X className="w-3 h-3" />
                        Clear all
                    </button>
                )}
            </div>

            {/* Location/Park Filter */}
            {locations.length > 0 && (
                <div>
                    <label className="text-xs font-medium text-gray-700 mb-2 block">Location / Park</label>
                    <div className="flex flex-wrap gap-2">
                        {locations.map(location => (
                            <button
                                key={location}
                                onClick={() => onLocationToggle(location)}
                                className={`px-3 py-1.5 rounded-md text-sm transition-all ${selectedLocations.has(location)
                                        ? 'bg-primary-600 text-white font-medium'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                                    }`}
                            >
                                {location}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Facilities Filter */}
            {facilities.length > 0 && (
                <div>
                    <label className="text-xs font-medium text-gray-700 mb-2 block">Facilities</label>
                    <div className="flex flex-wrap gap-2">
                        {facilities.map(facility => (
                            <button
                                key={facility}
                                onClick={() => onFacilityToggle(facility)}
                                className={`px-3 py-1.5 rounded-md text-sm transition-all ${selectedFacilities.has(facility)
                                        ? 'bg-primary-600 text-white font-medium'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                                    }`}
                            >
                                {facility}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Accommodation Type Filter */}
            {accommodationTypes.length > 0 && (
                <div>
                    <label className="text-xs font-medium text-gray-700 mb-2 block">Accommodation Type</label>
                    <div className="flex flex-wrap gap-2">
                        {accommodationTypes.map(type => (
                            <button
                                key={type}
                                onClick={() => onAccommodationTypeToggle(type)}
                                className={`px-3 py-1.5 rounded-md text-sm transition-all ${selectedAccommodationTypes.has(type)
                                        ? 'bg-primary-600 text-white font-medium'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
