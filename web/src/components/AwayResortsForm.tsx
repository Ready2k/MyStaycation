'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface AwayResortsFormProps {
    initialData?: any;
    onSuccess: () => void;
    onBack: () => void;
}

interface Park {
    id: string;
    name: string;
    region: string | null;
    parkCode: string | null;
}

export function AwayResortsForm({ initialData, onSuccess, onBack }: AwayResortsFormProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        name: '',
        parks: [] as string[],
        dateStart: '',
        dateEnd: '',
        nights: 7,
        adults: 2,
        children: 0,
        pets: 0,
        budgetMax: null as number | null,
        alertSensitivity: 'INSTANT' as 'INSTANT' | 'DIGEST' | 'EXCEPTIONAL_ONLY',
        checkFrequencyHours: 48 as number,
    });
    const [parkSearch, setParkSearch] = useState('');

    // Fetch Away Resorts parks from the DB
    const { data: parksData, isLoading: parksLoading } = useQuery({
        queryKey: ['parks', 'awayresorts'],
        queryFn: async () => {
            const { data } = await api.get<{ parks: Park[] }>('/parks?provider=awayresorts');
            return data.parks;
        },
    });

    const parks = parksData ?? [];

    // Group parks by region for display
    const parksByRegion = parks.reduce<Record<string, Park[]>>((acc, park) => {
        const region = park.region ?? 'Other';
        if (!acc[region]) acc[region] = [];
        acc[region].push(park);
        return acc;
    }, {});

    const filteredParks = parkSearch.trim()
        ? parks.filter(p =>
            p.name.toLowerCase().includes(parkSearch.toLowerCase()) ||
            (p.region ?? '').toLowerCase().includes(parkSearch.toLowerCase())
        )
        : parks;

    const filteredByRegion = parkSearch.trim()
        ? { 'Results': filteredParks }
        : parksByRegion;

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                parks: Array.isArray(initialData.parkIds) ? initialData.parkIds :
                    (typeof initialData.parkIds === 'string'
                        ? initialData.parkIds.split(',').map((p: string) => p.trim()).filter(Boolean)
                        : []),
                dateStart: initialData.dateStart ? initialData.dateStart.split('T')[0] : '',
                dateEnd: initialData.dateEnd ? initialData.dateEnd.split('T')[0] : '',
                nights: initialData.durationNightsMin || 7,
                adults: initialData.partySizeAdults || 2,
                children: initialData.partySizeChildren || 0,
                pets: initialData.petsNumber || 0,
                budgetMax: initialData.budgetCeilingGbp || null,
                alertSensitivity: initialData.alertSensitivity || 'INSTANT',
                checkFrequencyHours: initialData.checkFrequencyHours || 48,
            });
        }
    }, [initialData]);

    const togglePark = (parkCode: string) => {
        const selected = formData.parks.includes(parkCode)
            ? formData.parks.filter(p => p !== parkCode)
            : [...formData.parks, parkCode];
        setFormData({ ...formData, parks: selected });
    };

    const saveMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const payload = {
                name: data.name,
                providerCode: 'awayresorts',
                parkIds: data.parks, // Numeric IDs e.g. ['7', '23']
                dateStart: data.dateStart,
                dateEnd: data.dateEnd,
                durationNightsMin: data.nights,
                durationNightsMax: data.nights,
                partySizeAdults: data.adults,
                partySizeChildren: data.children,
                petsNumber: data.pets,
                pets: data.pets > 0,
                budgetCeilingGbp: data.budgetMax || undefined,
                alertSensitivity: data.alertSensitivity,
                checkFrequencyHours: data.checkFrequencyHours,
                flexType: 'RANGE',
            };

            if (initialData?.id) {
                const response = await api.put(`/profiles/${initialData.id}`, payload);
                return response.data;
            } else {
                const response = await api.post('/profiles', payload);
                return response.data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            onSuccess();
        },
        onError: (error: any) => {
            alert(`Failed to save watcher: ${error.response?.data?.message || error.message}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.parks.length === 0) {
            alert('Please select at least one Away Resorts location');
            return;
        }
        saveMutation.mutate(formData);
    };

    // Resolve park names for selected codes (for the summary badge)
    const selectedParkNames = formData.parks
        .map(code => parks.find(p => p.parkCode === code)?.name ?? code)
        .join(', ');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-8">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">Away Resorts Watcher</h2>
                    <p className="mt-1 text-sm text-gray-500">Monitor prices across Away Resorts locations</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Watcher Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Watcher Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="e.g., Summer Away Resorts Break"
                        />
                    </div>

                    {/* Park Picker */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            📍 Locations
                            {formData.parks.length > 0 && (
                                <span className="ml-2 text-xs text-purple-600 font-normal">
                                    {formData.parks.length} selected
                                </span>
                            )}
                        </label>

                        {parksLoading ? (
                            <div className="border border-gray-200 rounded-md p-4 text-sm text-gray-500 text-center">
                                Loading locations...
                            </div>
                        ) : (
                            <div className="border border-gray-200 rounded-md overflow-hidden">
                                {/* Search */}
                                <div className="p-2 border-b border-gray-100 bg-gray-50">
                                    <input
                                        type="text"
                                        value={parkSearch}
                                        onChange={(e) => setParkSearch(e.target.value)}
                                        placeholder="Filter locations..."
                                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                                    />
                                </div>

                                {/* Park list */}
                                <div className="max-h-52 overflow-y-auto">
                                    {Object.entries(filteredByRegion).map(([region, regionParks]) => (
                                        <div key={region}>
                                            <div className="px-3 py-1 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                                                {region}
                                            </div>
                                            {regionParks.map(park => {
                                                if (!park.parkCode) return null;
                                                const checked = formData.parks.includes(park.parkCode);
                                                return (
                                                    <label
                                                        key={park.id}
                                                        className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0 ${checked ? 'bg-purple-50' : ''}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => togglePark(park.parkCode!)}
                                                            className="h-4 w-4 text-purple-600 rounded"
                                                        />
                                                        <span className="ml-2 text-sm text-gray-800">{park.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    ))}
                                    {filteredParks.length === 0 && (
                                        <p className="px-3 py-4 text-sm text-gray-400 text-center">No locations match</p>
                                    )}
                                </div>

                                {/* Selected summary */}
                                {formData.parks.length > 0 && (
                                    <div className="px-3 py-2 bg-purple-50 border-t border-purple-100 text-xs text-purple-700">
                                        <strong>Selected:</strong> {selectedParkNames}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
                            <input
                                type="date"
                                required
                                value={formData.dateStart}
                                onChange={(e) => setFormData({ ...formData, dateStart: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
                            <input
                                type="date"
                                required
                                value={formData.dateEnd}
                                onChange={(e) => setFormData({ ...formData, dateEnd: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nights</label>
                            <input
                                type="number"
                                min="1"
                                max="14"
                                value={formData.nights}
                                onChange={(e) => setFormData({ ...formData, nights: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                    </div>

                    {/* Party */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Adults</label>
                            <input
                                type="number"
                                min="1"
                                max="8"
                                value={formData.adults}
                                onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Children</label>
                            <input
                                type="number"
                                min="0"
                                max="8"
                                value={formData.children}
                                onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pets</label>
                            <input
                                type="number"
                                min="0"
                                max="2"
                                value={formData.pets}
                                onChange={(e) => setFormData({ ...formData, pets: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                    </div>

                    {/* Budget */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">💰 Maximum Budget (optional)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">£</span>
                            <input
                                type="number"
                                min="0"
                                value={formData.budgetMax || ''}
                                onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value ? parseInt(e.target.value) : null })}
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md"
                                placeholder="No limit"
                            />
                        </div>
                    </div>

                    {/* Alert Sensitivity */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">🔔 Alert Sensitivity</label>
                        <select
                            value={formData.alertSensitivity}
                            onChange={(e) => setFormData({ ...formData, alertSensitivity: e.target.value as any })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                            <option value="INSTANT">Instant (every price drop)</option>
                            <option value="DIGEST">Daily digest</option>
                            <option value="EXCEPTIONAL_ONLY">Exceptional deals only (&gt;20% drop)</option>
                        </select>
                    </div>

                    {/* Check Frequency */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">⏱ Check Frequency</label>
                        <select
                            value={formData.checkFrequencyHours}
                            onChange={(e) => setFormData({ ...formData, checkFrequencyHours: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                            <option value="12">Every 12 hours</option>
                            <option value="24">Every 24 hours</option>
                            <option value="48">Every 48 hours (default)</option>
                            <option value="168">Weekly</option>
                        </select>
                    </div>
                </form>

                <div className="p-6 border-t border-gray-200 flex justify-between bg-gray-50">
                    <button
                        onClick={onBack}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saveMutation.isPending || parksLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
                    >
                        {saveMutation.isPending ? 'Saving...' : (initialData ? 'Update Watcher' : 'Create Watcher')}
                    </button>
                </div>
            </div>
        </div>
    );
}
