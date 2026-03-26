'use client';

import { X, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// Custom Dropdown Component
function MultiSelectDropdown({ 
    label, 
    options, 
    selected, 
    onToggle 
}: { 
    label: string; 
    options: string[]; 
    selected: Set<string>; 
    onToggle: (option: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (options.length === 0) return null;

    const selectedCount = selected.size;

    return (
        <div className="relative inline-block text-left mr-3 mb-3" ref={dropdownRef}>
            <div>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`inline-flex items-center justify-between min-w-[220px] px-4 py-2 text-sm font-medium border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors ${
                        selectedCount > 0 
                            ? 'bg-primary-50 border-primary-300 text-primary-700' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <span>
                        {label} {selectedCount > 0 && <span className="ml-1.5 bg-primary-100 text-primary-800 py-0.5 px-2 rounded-full text-xs font-bold">{selectedCount}</span>}
                    </span>
                    <ChevronDown className={`w-4 h-4 ml-2 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {isOpen && (
                <div className="absolute z-20 w-80 mt-2 origin-top-left bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1 max-h-64 overflow-y-auto">
                        {options.map((option) => (
                            <label
                                key={option}
                                className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 mr-3 shrink-0"
                                    checked={selected.has(option)}
                                    onChange={() => onToggle(option)}
                                />
                                <span className="truncate select-none" title={option}>{option}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

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
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-gray-900">Filters</h4>
                {hasActiveFilters && (
                    <button
                        onClick={onClearAll}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1.5 transition-colors bg-white border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-100 shadow-sm"
                    >
                        <X className="w-3.5 h-3.5" />
                        Clear active filters
                    </button>
                )}
            </div>

            {/* Dropdowns Container */}
            <div className="flex flex-wrap items-start">
                <MultiSelectDropdown
                    label="Location / Park"
                    options={locations}
                    selected={selectedLocations}
                    onToggle={onLocationToggle}
                />

                <MultiSelectDropdown
                    label="Accommodation Type"
                    options={accommodationTypes}
                    selected={selectedAccommodationTypes}
                    onToggle={onAccommodationTypeToggle}
                />

                <MultiSelectDropdown
                    label="Facilities"
                    options={facilities}
                    selected={selectedFacilities}
                    onToggle={onFacilityToggle}
                />
            </div>
        </div>
    );
}
