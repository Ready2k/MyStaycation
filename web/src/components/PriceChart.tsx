'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { useState, useMemo } from 'react';
import { FilterPanel } from './FilterPanel';
import { PriceInsights } from './PriceInsights';
import { ComparisonTable } from './ComparisonTable';

interface DataPoint {
    date: string;
    price: number;
    pricePerNight: number;
    availability: string;
    sourceUrl?: string;
}

interface SeriesData {
    seriesKey: string;
    stayStartDate: string;
    stayNights: number;
    accomName?: string;
    accomTypeId?: string;
    parkName?: string;
    parkRegion?: string;
    data: DataPoint[];
    statistics: {
        minPrice: number;
        maxPrice: number;
        avgPrice: number;
        currentPrice: number;
        priceChangePercent: number;
        dataPoints: number;
    };
}

interface PriceChartProps {
    series: SeriesData[];
    isLoading?: boolean;
    metadata?: {
        profileName?: string;
        region?: string;
        facilities?: string[];
        pets?: boolean;
        accommodationType?: string;
    };
}

const COLORS = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#06b6d4', // cyan
    '#f43f5e', // rose
];

export function PriceChart({ series, isLoading, metadata }: PriceChartProps) {
    const [visibleSeries, setVisibleSeries] = useState<Set<string>>(new Set());
    const [dateRange, setDateRange] = useState<number>(90); // days

    // Filter states
    const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
    const [selectedFacilities, setSelectedFacilities] = useState<Set<string>>(new Set());
    const [selectedAccommodationTypes, setSelectedAccommodationTypes] = useState<Set<string>>(new Set());

    // Extract unique filter options from series
    const filterOptions = useMemo(() => {
        const locations = new Set<string>();
        const accommodationTypes = new Set<string>();

        series.forEach(s => {
            if (s.parkName) locations.add(s.parkName);
            else if (s.parkRegion) locations.add(s.parkRegion);
            if (s.accomName) accommodationTypes.add(s.accomName);
        });

        return {
            locations: Array.from(locations).sort(),
            facilities: metadata?.facilities || [],
            accommodationTypes: Array.from(accommodationTypes).sort(),
        };
    }, [series, metadata]);

    // Apply filters to series
    const filteredSeries = useMemo(() => {
        return series.filter(s => {
            // Location filter
            if (selectedLocations.size > 0) {
                const location = s.parkName || s.parkRegion;
                if (!location || !selectedLocations.has(location)) return false;
            }

            // Accommodation type filter
            if (selectedAccommodationTypes.size > 0) {
                if (!s.accomName || !selectedAccommodationTypes.has(s.accomName)) return false;
            }

            return true;
        });
    }, [series, selectedLocations, selectedAccommodationTypes]);

    if (isLoading) {
        return (
            <div className="bg-gray-50 rounded-lg p-8 flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600">Loading price history...</p>
                </div>
            </div>
        );
    }

    if (series.length === 0) {
        return (
            <div className="bg-gray-50 rounded-lg p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
                <span className="text-6xl mb-4">📊</span>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Price Data Yet</h3>
                <p className="text-sm text-gray-600 max-w-md">
                    Price history will appear here once monitoring runs have collected data.
                    This usually takes 1-2 days after creating a watcher.
                </p>
            </div>
        );
    }

    const getSeriesLabel = (s: SeriesData) => {
        const datePart = `${format(new Date(s.stayStartDate), 'MMM d')} (${s.stayNights}n)`;
        return s.accomName ? `${s.accomName} • ${datePart}` : datePart;
    };

    // Calculate average price for reference line
    const avgPrice = filteredSeries
        .filter(s => visibleSeries.has(s.seriesKey))
        .reduce((sum, s) => sum + s.statistics.currentPrice, 0) /
        Math.max(1, filteredSeries.filter(s => visibleSeries.has(s.seriesKey)).length);

    // Flatten all data points for the chart
    const chartData: any[] = [];
    const dateMap = new Map<string, any>();

    filteredSeries.forEach((s) => {
        if (!visibleSeries.has(s.seriesKey)) return;

        s.data.forEach(point => {
            const dateKey = new Date(point.date).toISOString();
            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, { date: dateKey });
            }
            const label = getSeriesLabel(s);
            dateMap.get(dateKey)[label] = point.price;
        });
    });

    chartData.push(...Array.from(dateMap.values()).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    ));

    const toggleSeries = (seriesKey: string) => {
        const newVisible = new Set(visibleSeries);
        if (newVisible.has(seriesKey)) {
            newVisible.delete(seriesKey);
        } else {
            newVisible.add(seriesKey);
        }
        setVisibleSeries(newVisible);
    };

    // Quick action handlers
    const selectAll = () => {
        setVisibleSeries(new Set(filteredSeries.map(s => s.seriesKey)));
    };

    const selectTop5 = () => {
        const sorted = [...filteredSeries].sort((a, b) => a.statistics.currentPrice - b.statistics.currentPrice);
        setVisibleSeries(new Set(sorted.slice(0, 5).map(s => s.seriesKey)));
    };

    const clearAll = () => {
        setVisibleSeries(new Set());
    };

    // Filter handlers
    const handleLocationToggle = (location: string) => {
        const newSelected = new Set(selectedLocations);
        if (newSelected.has(location)) {
            newSelected.delete(location);
        } else {
            newSelected.add(location);
        }
        setSelectedLocations(newSelected);
    };

    const handleFacilityToggle = (facility: string) => {
        const newSelected = new Set(selectedFacilities);
        if (newSelected.has(facility)) {
            newSelected.delete(facility);
        } else {
            newSelected.add(facility);
        }
        setSelectedFacilities(newSelected);
    };

    const handleAccommodationTypeToggle = (type: string) => {
        const newSelected = new Set(selectedAccommodationTypes);
        if (newSelected.has(type)) {
            newSelected.delete(type);
        } else {
            newSelected.add(type);
        }
        setSelectedAccommodationTypes(newSelected);
    };

    const handleClearAllFilters = () => {
        setSelectedLocations(new Set());
        setSelectedFacilities(new Set());
        setSelectedAccommodationTypes(new Set());
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <FilterPanel
                locations={filterOptions.locations}
                facilities={filterOptions.facilities}
                accommodationTypes={filterOptions.accommodationTypes}
                selectedLocations={selectedLocations}
                selectedFacilities={selectedFacilities}
                selectedAccommodationTypes={selectedAccommodationTypes}
                onLocationToggle={handleLocationToggle}
                onFacilityToggle={handleFacilityToggle}
                onAccommodationTypeToggle={handleAccommodationTypeToggle}
                onClearAll={handleClearAllFilters}
            />

            {/* Price Insights */}
            <PriceInsights series={filteredSeries} visibleSeries={visibleSeries} />

            {/* Chart */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                {/* Controls */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Price History</h3>
                        <p className="text-sm text-gray-500">
                            Showing {visibleSeries.size} of {filteredSeries.length} {filteredSeries.length === 1 ? 'option' : 'options'}
                            {filteredSeries.length !== series.length && ` (${series.length - filteredSeries.length} filtered out)`}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {/* Quick Actions */}
                        <button
                            onClick={selectAll}
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                            Select All
                        </button>
                        <button
                            onClick={selectTop5}
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                            Top 5
                        </button>
                        <button
                            onClick={clearAll}
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                            Clear
                        </button>

                        {/* Date Range Selector */}
                        <div className="border-l border-gray-300 pl-2 ml-2 flex gap-2">
                            {[7, 30, 90].map(days => (
                                <button
                                    key={days}
                                    onClick={() => setDateRange(days)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateRange === days
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {days}d
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Chart */}
                {visibleSeries.size > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(date) => format(new Date(date), 'MMM d')}
                                stroke="#6b7280"
                                style={{ fontSize: '12px' }}
                            />
                            <YAxis
                                stroke="#6b7280"
                                style={{ fontSize: '12px' }}
                                tickFormatter={(value) => `£${value}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    padding: '12px',
                                }}
                                labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy HH:mm')}
                                formatter={(value: any) => [`£${value}`, 'Price']}
                            />
                            <Legend
                                wrapperStyle={{ paddingTop: '20px' }}
                                onClick={(e) => {
                                    // Find series by label
                                    const clickedSeries = filteredSeries.find(s => {
                                        const label = getSeriesLabel(s);
                                        return label === e.value;
                                    });
                                    if (clickedSeries) {
                                        toggleSeries(clickedSeries.seriesKey);
                                    }
                                }}
                            />
                            {/* Average price reference line */}
                            {visibleSeries.size > 1 && (
                                <ReferenceLine
                                    y={avgPrice}
                                    stroke="#9ca3af"
                                    strokeDasharray="5 5"
                                    label={{ value: `Avg: £${Math.round(avgPrice)}`, position: 'right', fill: '#6b7280', fontSize: 12 }}
                                />
                            )}
                            {filteredSeries.map((s, index) => {
                                if (!visibleSeries.has(s.seriesKey)) return null;
                                const label = getSeriesLabel(s);
                                return (
                                    <Line
                                        key={s.seriesKey}
                                        type="monotone"
                                        dataKey={label}
                                        stroke={COLORS[index % COLORS.length]}
                                        strokeWidth={2}
                                        dot={{ r: 4 }}
                                        activeDot={{ r: 6 }}
                                        connectNulls
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-lg">
                        <div className="text-center">
                            <p className="text-gray-500 mb-2">No options selected</p>
                            <button
                                onClick={selectTop5}
                                className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                            >
                                Show Top 5 Deals
                            </button>
                        </div>
                    </div>
                )}

                {/* Series Legend with Toggle */}
                <div className="mt-6 border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Stay Options (click to toggle)</h4>
                    <div className="flex flex-wrap gap-2">
                        {filteredSeries.map((s, index) => (
                            <button
                                key={s.seriesKey}
                                onClick={() => toggleSeries(s.seriesKey)}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${visibleSeries.has(s.seriesKey)
                                    ? 'bg-white border-2 text-gray-900'
                                    : 'bg-gray-100 border-2 border-transparent text-gray-500 opacity-50'
                                    }`}
                                style={{
                                    borderColor: visibleSeries.has(s.seriesKey) ? COLORS[index % COLORS.length] : 'transparent',
                                }}
                            >
                                <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span>
                                    {getSeriesLabel(s)}
                                </span>
                                <span className="text-xs text-gray-500">
                                    £{s.statistics.currentPrice}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Comparison Table */}
            <ComparisonTable series={filteredSeries} visibleSeries={visibleSeries} />
        </div>
    );
}
