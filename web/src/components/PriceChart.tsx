'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { useState } from 'react';

interface DataPoint {
    date: string;
    price: number;
    availability: string;
}

interface SeriesData {
    seriesKey: string;
    stayStartDate: string;
    stayNights: number;
    data: DataPoint[];
}

interface PriceChartProps {
    series: SeriesData[];
    isLoading?: boolean;
}

const COLORS = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
];

export function PriceChart({ series, isLoading }: PriceChartProps) {
    const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
        new Set(series.map(s => s.seriesKey))
    );
    const [dateRange, setDateRange] = useState<number>(90); // days

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

    // Flatten all data points for the chart
    const chartData: any[] = [];
    const dateMap = new Map<string, any>();

    series.forEach((s, index) => {
        if (!visibleSeries.has(s.seriesKey)) return;

        s.data.forEach(point => {
            const dateKey = new Date(point.date).toISOString();
            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, { date: dateKey });
            }
            const label = `${format(new Date(s.stayStartDate), 'MMM d')} (${s.stayNights}n)`;
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

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Price History</h3>
                    <p className="text-sm text-gray-500">
                        Showing {visibleSeries.size} of {series.length} {series.length === 1 ? 'option' : 'options'}
                    </p>
                </div>

                {/* Date Range Selector */}
                <div className="flex gap-2">
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

            {/* Chart */}
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
                            const clickedSeries = series.find(s => {
                                const label = `${format(new Date(s.stayStartDate), 'MMM d')} (${s.stayNights}n)`;
                                return label === e.value;
                            });
                            if (clickedSeries) {
                                toggleSeries(clickedSeries.seriesKey);
                            }
                        }}
                    />
                    {series.map((s, index) => {
                        if (!visibleSeries.has(s.seriesKey)) return null;
                        const label = `${format(new Date(s.stayStartDate), 'MMM d')} (${s.stayNights}n)`;
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

            {/* Series Legend with Toggle */}
            <div className="mt-6 border-t border-gray-100 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Stay Options (click to toggle)</h4>
                <div className="flex flex-wrap gap-2">
                    {series.map((s, index) => (
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
                                {format(new Date(s.stayStartDate), 'MMM d, yyyy')} • {s.stayNights} nights
                            </span>
                            <span className="text-xs text-gray-500">
                                ({s.data.length} checks)
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
