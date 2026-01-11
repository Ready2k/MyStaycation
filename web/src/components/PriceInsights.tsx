'use client';

import { TrendingDown, TrendingUp, Target, Clock } from 'lucide-react';

interface SeriesData {
    seriesKey: string;
    statistics: {
        currentPrice: number;
        minPrice: number;
        maxPrice: number;
        avgPrice: number;
        priceChangePercent: number;
        dataPoints: number;
    };
    accomName?: string;
    parkName?: string;
    stayStartDate: string;
    stayNights: number;
}

interface PriceInsightsProps {
    series: SeriesData[];
    visibleSeries: Set<string>;
}

export function PriceInsights({ series, visibleSeries }: PriceInsightsProps) {
    if (series.length === 0) return null;

    // Only consider visible series
    const activeSeries = series.filter(s => visibleSeries.has(s.seriesKey));
    if (activeSeries.length === 0) return null;

    // Find best deal (lowest current price)
    const bestDeal = activeSeries.reduce((best, current) =>
        current.statistics.currentPrice < best.statistics.currentPrice ? current : best
    );

    // Calculate average across all visible series
    const avgPrice = activeSeries.reduce((sum, s) => sum + s.statistics.currentPrice, 0) / activeSeries.length;

    // Find series with biggest price drop
    const biggestDrop = activeSeries
        .filter(s => s.statistics.priceChangePercent < 0)
        .reduce((biggest, current) =>
            current.statistics.priceChangePercent < biggest.statistics.priceChangePercent ? current : biggest
            , { statistics: { priceChangePercent: 0 } } as any);

    // Find series with biggest price increase
    const biggestIncrease = activeSeries
        .filter(s => s.statistics.priceChangePercent > 0)
        .reduce((biggest, current) =>
            current.statistics.priceChangePercent > biggest.statistics.priceChangePercent ? current : biggest
            , { statistics: { priceChangePercent: 0 } } as any);

    // Calculate prediction confidence based on data points
    const avgDataPoints = activeSeries.reduce((sum, s) => sum + s.statistics.dataPoints, 0) / activeSeries.length;
    const confidence = avgDataPoints >= 7 ? 'High' : avgDataPoints >= 4 ? 'Medium' : 'Low';

    // Determine recommendation
    const avgTrend = activeSeries.reduce((sum, s) => sum + s.statistics.priceChangePercent, 0) / activeSeries.length;
    const recommendation = avgTrend < -5
        ? { text: '📈 Book now - prices have been dropping!', color: 'text-green-700', bg: 'bg-green-50' }
        : avgTrend > 5
            ? { text: '⏳ Consider waiting - prices are rising', color: 'text-amber-700', bg: 'bg-amber-50' }
            : { text: '📊 Prices are stable', color: 'text-blue-700', bg: 'bg-blue-50' };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Best Deal */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-green-600" />
                    <p className="text-xs font-semibold text-green-900 uppercase tracking-wide">Best Deal</p>
                </div>
                <p className="text-2xl font-bold text-green-900">£{bestDeal.statistics.currentPrice}</p>
                <p className="text-xs text-green-700 mt-1 truncate">
                    {bestDeal.accomName || bestDeal.parkName || 'Option'}
                </p>
            </div>

            {/* Average Price */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Average Price</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">£{Math.round(avgPrice)}</p>
                <p className="text-xs text-gray-600 mt-1">
                    Across {activeSeries.length} option{activeSeries.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Biggest Change */}
            {(biggestDrop.statistics?.priceChangePercent < 0 || biggestIncrease.statistics?.priceChangePercent > 0) && (
                <div className={`rounded-lg p-4 border ${Math.abs(biggestDrop.statistics?.priceChangePercent || 0) > Math.abs(biggestIncrease.statistics?.priceChangePercent || 0)
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-center gap-2 mb-2">
                        {Math.abs(biggestDrop.statistics?.priceChangePercent || 0) > Math.abs(biggestIncrease.statistics?.priceChangePercent || 0) ? (
                            <>
                                <TrendingDown className="w-4 h-4 text-green-600" />
                                <p className="text-xs font-semibold text-green-900 uppercase tracking-wide">Biggest Drop</p>
                            </>
                        ) : (
                            <>
                                <TrendingUp className="w-4 h-4 text-red-600" />
                                <p className="text-xs font-semibold text-red-900 uppercase tracking-wide">Biggest Increase</p>
                            </>
                        )}
                    </div>
                    <p className={`text-2xl font-bold ${Math.abs(biggestDrop.statistics?.priceChangePercent || 0) > Math.abs(biggestIncrease.statistics?.priceChangePercent || 0)
                            ? 'text-green-900'
                            : 'text-red-900'
                        }`}>
                        {Math.abs(biggestDrop.statistics?.priceChangePercent || 0) > Math.abs(biggestIncrease.statistics?.priceChangePercent || 0)
                            ? `${Math.abs(biggestDrop.statistics.priceChangePercent).toFixed(1)}%`
                            : `+${biggestIncrease.statistics.priceChangePercent.toFixed(1)}%`
                        }
                    </p>
                    <p className="text-xs mt-1 truncate" style={{
                        color: Math.abs(biggestDrop.statistics?.priceChangePercent || 0) > Math.abs(biggestIncrease.statistics?.priceChangePercent || 0) ? '#065f46' : '#991b1b'
                    }}>
                        {Math.abs(biggestDrop.statistics?.priceChangePercent || 0) > Math.abs(biggestIncrease.statistics?.priceChangePercent || 0)
                            ? (biggestDrop.accomName || biggestDrop.parkName || 'Option')
                            : (biggestIncrease.accomName || biggestIncrease.parkName || 'Option')
                        }
                    </p>
                </div>
            )}

            {/* Recommendation */}
            <div className={`rounded-lg p-4 border ${recommendation.bg} border-${recommendation.color.split('-')[1]}-200`}>
                <div className="flex items-center gap-2 mb-2">
                    <Clock className={`w-4 h-4 ${recommendation.color}`} />
                    <p className={`text-xs font-semibold uppercase tracking-wide ${recommendation.color}`}>
                        Recommendation
                    </p>
                </div>
                <p className={`text-sm font-medium ${recommendation.color} leading-tight`}>
                    {recommendation.text}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                    Confidence: <span className="font-semibold">{confidence}</span>
                </p>
            </div>
        </div>
    );
}
