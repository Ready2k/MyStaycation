'use client';

import { format } from 'date-fns';
import { ArrowUp, ArrowDown, Minus, ExternalLink } from 'lucide-react';
import { useState } from 'react';

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
    parkName?: string;
    parkRegion?: string;
    data: DataPoint[];
    statistics: {
        currentPrice: number;
        minPrice: number;
        maxPrice: number;
        avgPrice: number;
        priceChangePercent: number;
        dataPoints: number;
    };
}

interface ComparisonTableProps {
    series: SeriesData[];
    visibleSeries: Set<string>;
}

type SortField = 'accomName' | 'parkName' | 'stayStartDate' | 'currentPrice' | 'pricePerNight' | 'priceChange';
type SortDirection = 'asc' | 'desc';

export function ComparisonTable({ series, visibleSeries }: ComparisonTableProps) {
    const [sortField, setSortField] = useState<SortField>('currentPrice');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // Filter to only visible series
    const activeSeries = series.filter(s => visibleSeries.has(s.seriesKey));

    if (activeSeries.length === 0) {
        return null;
    }

    // Find the best deal (lowest price)
    const lowestPrice = Math.min(...activeSeries.map(s => s.statistics.currentPrice));

    // Sorting logic
    const sortedSeries = [...activeSeries].sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
            case 'accomName':
                comparison = (a.accomName || '').localeCompare(b.accomName || '');
                break;
            case 'parkName':
                comparison = (a.parkName || '').localeCompare(b.parkName || '');
                break;
            case 'stayStartDate':
                comparison = new Date(a.stayStartDate).getTime() - new Date(b.stayStartDate).getTime();
                break;
            case 'currentPrice':
                comparison = a.statistics.currentPrice - b.statistics.currentPrice;
                break;
            case 'pricePerNight':
                const aPerNight = a.data[a.data.length - 1]?.pricePerNight || 0;
                const bPerNight = b.data[b.data.length - 1]?.pricePerNight || 0;
                comparison = aPerNight - bPerNight;
                break;
            case 'priceChange':
                comparison = a.statistics.priceChangePercent - b.statistics.priceChangePercent;
                break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Comparison Table</h3>
                <p className="text-sm text-gray-500 mt-1">Click column headers to sort</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('accomName')}
                            >
                                <div className="flex items-center gap-1">
                                    Accommodation
                                    <SortIcon field="accomName" />
                                </div>
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('parkName')}
                            >
                                <div className="flex items-center gap-1">
                                    Location
                                    <SortIcon field="parkName" />
                                </div>
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('stayStartDate')}
                            >
                                <div className="flex items-center gap-1">
                                    Date
                                    <SortIcon field="stayStartDate" />
                                </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Duration
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('currentPrice')}
                            >
                                <div className="flex items-center gap-1">
                                    Total Price
                                    <SortIcon field="currentPrice" />
                                </div>
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('pricePerNight')}
                            >
                                <div className="flex items-center gap-1">
                                    Per Night
                                    <SortIcon field="pricePerNight" />
                                </div>
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('priceChange')}
                            >
                                <div className="flex items-center gap-1">
                                    Trend
                                    <SortIcon field="priceChange" />
                                </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedSeries.map((s, index) => {
                            const isBestDeal = s.statistics.currentPrice === lowestPrice;
                            const latestData = s.data[s.data.length - 1];

                            return (
                                <tr
                                    key={s.seriesKey}
                                    className={`hover:bg-gray-50 ${isBestDeal ? 'bg-green-50' : ''}`}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {isBestDeal && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    Best Deal
                                                </span>
                                            )}
                                            <span className="text-sm font-medium text-gray-900">
                                                {s.accomName || 'Unknown'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{s.parkName || '-'}</div>
                                        {s.parkRegion && (
                                            <div className="text-xs text-gray-500">{s.parkRegion}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {format(new Date(s.stayStartDate), 'MMM d, yyyy')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {s.stayNights} night{s.stayNights !== 1 ? 's' : ''}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-semibold text-gray-900">
                                            £{s.statistics.currentPrice.toFixed(2)}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            £{s.statistics.minPrice} - £{s.statistics.maxPrice}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        £{latestData?.pricePerNight?.toFixed(2) || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {s.statistics.priceChangePercent !== 0 ? (
                                            <div className={`flex items-center gap-1 text-sm font-medium ${s.statistics.priceChangePercent < 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                {s.statistics.priceChangePercent < 0 ? (
                                                    <ArrowDown className="w-4 h-4" />
                                                ) : (
                                                    <ArrowUp className="w-4 h-4" />
                                                )}
                                                {Math.abs(s.statistics.priceChangePercent).toFixed(1)}%
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-sm text-gray-500">
                                                <Minus className="w-4 h-4" />
                                                Stable
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {latestData?.sourceUrl ? (
                                            <a
                                                href={latestData.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary-600 hover:text-primary-700 flex items-center gap-1 text-sm font-medium"
                                            >
                                                View
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ) : (
                                            <span className="text-sm text-gray-400">N/A</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
