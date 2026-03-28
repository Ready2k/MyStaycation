'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface ForestHolidaysFormProps {
    initialData?: any;
    onSuccess: () => void;
    onBack: () => void;
}

interface ForestHolidaysFormData {
    name: string;
    parks: string[];
    dateStart: string;
    dateEnd: string;
    nights: number;
    party: {
        adults: number;
        children: number; // 2-16 years
        infants: number;  // Under 2 years
        dogs: number;
    };
    minBedrooms: number;
    budgetMax: number | null;
    alertSensitivity: 'INSTANT' | 'DIGEST' | 'EXCEPTIONAL_ONLY';
    checkFrequencyHours: number;
    // Filters
    cabinTiers: string[];
    isPetFriendlyOnly: boolean;
}

const PARKS = [
    { code: '468bfc3f-c237-4d92-a99d-0c73face813a', name: 'Ardgartan Argyll' },
    { code: '49ae88aa-bee1-4941-8366-047e9d38a2d5', name: 'Beddgelert Snowdonia' },
    { code: '4c774808-aeb5-4ed8-8b16-67bf66bfd117', name: 'Blackwood Forest' },
    { code: '58d9ad0f-1e29-4b12-b85a-ab93b467283e', name: 'Thorpe Forest' },
    { code: '7123264d-f469-4332-8e31-95d59eb038d1', name: 'Forest of Dean' },
    { code: '8c1e4087-8f0a-496b-96c3-81643a9737f6', name: 'Deerpark' },
    { code: '8e473341-c16b-4f36-a779-e2d7f023cfbe', name: 'Strathyre' },
    { code: '91ee8989-c3be-4377-8b74-48887adcc062', name: 'Cropton' },
    { code: 'c1581d0c-8b36-4859-832d-e70d6e8c1efb', name: 'Keldy' },
    { code: 'd62c573b-dd69-4582-af9f-217cee647e1f', name: 'Garwnant' },
    { code: 'd701ccb7-b080-4f79-9870-8bac8a5c08ea', name: 'Sherwood Forest' },
    { code: 'db63a0ad-ff4d-4e84-9a9d-2cac0f5578f1', name: 'Delamere Forest' },
    { code: 'eb77d895-d7d1-42fe-af4a-2635e86dc17c', name: 'Glentress Forest' },
];

const CABIN_TIERS = [
    'Golden Oak',
    'Silver Birch',
    'Sky Oak',
    'White Willow',
    'Copper Beech',
    'Meadow',
    'Woodland'
];

export function ForestHolidaysForm({ initialData, onSuccess, onBack }: ForestHolidaysFormProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<ForestHolidaysFormData>({
        name: '',
        parks: [],
        dateStart: '',
        dateEnd: '',
        nights: 7,
        party: { adults: 2, children: 0, infants: 0, dogs: 0 },
        minBedrooms: 2,
        budgetMax: null,
        alertSensitivity: 'INSTANT',
        checkFrequencyHours: 48,
        cabinTiers: [],
        isPetFriendlyOnly: false,
    });

    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        if (initialData) {
            const metadata = initialData.metadata || {};
            setFormData({
                name: initialData.name || '',
                parks: initialData.parkIds || [],
                dateStart: initialData.dateStart ? initialData.dateStart.split('T')[0] : '',
                dateEnd: initialData.dateEnd ? initialData.dateEnd.split('T')[0] : '',
                nights: initialData.durationNightsMin || 7,
                party: metadata.partyBreakdown || { adults: initialData.partySizeAdults || 2, children: initialData.partySizeChildren || 0, infants: 0, dogs: initialData.petsNumber || 0 },
                minBedrooms: initialData.minBedrooms || 2,
                budgetMax: initialData.budgetCeilingGbp || null,
                alertSensitivity: initialData.alertSensitivity || 'INSTANT',
                checkFrequencyHours: initialData.checkFrequencyHours || 48,
                cabinTiers: metadata.cabinTiers || [],
                isPetFriendlyOnly: initialData.pets || false,
            });
        }
    }, [initialData]);

    const createMutation = useMutation({
        mutationFn: async (data: ForestHolidaysFormData) => {
            const payload = {
                name: data.name,
                providerCode: 'forestholidays',
                parkIds: data.parks,
                dateStart: data.dateStart,
                dateEnd: data.dateEnd,
                durationNightsMin: data.nights,
                durationNightsMax: data.nights,
                partySizeAdults: data.party.adults,
                partySizeChildren: data.party.children + data.party.infants,
                petsNumber: data.party.dogs,
                pets: data.isPetFriendlyOnly || data.party.dogs > 0,
                minBedrooms: data.minBedrooms,
                budgetCeilingGbp: data.budgetMax || undefined,
                alertSensitivity: data.alertSensitivity,
                checkFrequencyHours: data.checkFrequencyHours,
                flexType: 'RANGE',
                enabledProviders: ['forestholidays'],
                metadata: {
                    partyBreakdown: data.party,
                    cabinTiers: data.cabinTiers,
                    isPetFriendlyOnly: data.isPetFriendlyOnly
                }
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
            alert('Please select at least one park');
            return;
        }
        createMutation.mutate(formData);
    };

    const togglePark = (code: string) => {
        setFormData(prev => ({
            ...prev,
            parks: prev.parks.includes(code)
                ? prev.parks.filter(v => v !== code)
                : [...prev.parks, code]
        }));
    };

    const toggleAllParks = () => {
        if (formData.parks.length === PARKS.length) {
            setFormData(prev => ({ ...prev, parks: [] }));
        } else {
            setFormData(prev => ({ ...prev, parks: PARKS.map(p => p.code) }));
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 my-8">
                <div className="p-6 border-b border-green-100 bg-green-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">🌲 Forest Holidays Watcher</h2>
                        <p className="mt-1 text-sm text-gray-600">Track premium cabins and seasonal deals across UK forests</p>
                    </div>
                    <span className="text-4xl">🌲</span>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Watcher Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Watcher Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                            placeholder="e.g., Sherwood Forest Escape"
                        />
                    </div>

                    {/* Parks Selection */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">📍 Select Parks ({formData.parks.length}/{PARKS.length})</label>
                            <button
                                type="button"
                                onClick={toggleAllParks}
                                className="text-sm text-green-700 hover:text-green-800 font-medium"
                            >
                                {formData.parks.length === PARKS.length ? 'Deselect All' : 'Select All Parks'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {PARKS.map((park) => (
                                <label key={park.code} className={`flex items-center p-2.5 border rounded-lg cursor-pointer transition-colors ${formData.parks.includes(park.code) ? 'bg-green-50 border-green-300' : 'hover:bg-gray-50 border-gray-200'}`}>
                                    <input
                                        type="checkbox"
                                        checked={formData.parks.includes(park.code)}
                                        onChange={() => togglePark(park.code)}
                                        className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                    />
                                    <span className="ml-3 text-xs font-medium text-gray-900">{park.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Dates & Duration */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Check-in Only Before</label>
                            <input
                                type="date"
                                required
                                value={formData.dateStart}
                                onChange={(e) => setFormData({ ...formData, dateStart: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Latest Check-out</label>
                            <input
                                type="date"
                                required
                                value={formData.dateEnd}
                                onChange={(e) => setFormData({ ...formData, dateEnd: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Duration (Nights)</label>
                            <select
                                value={formData.nights}
                                onChange={(e) => setFormData({ ...formData, nights: parseInt(e.target.value) || 7 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                                <option value="3">3 Nights (Weekend)</option>
                                <option value="4">4 Nights (Midweek)</option>
                                <option value="7">7 Nights (Full Week)</option>
                                <option value="10">10 Nights</option>
                                <option value="11">11 Nights</option>
                                <option value="14">14 Nights</option>
                            </select>
                        </div>
                    </div>

                    {/* Party Breakdown */}
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <label className="block text-sm font-semibold text-gray-900 mb-4">👥 Party Breakdown</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Adults (16+)</label>
                                <input type="number" min="1" max="12" value={formData.party.adults} onChange={e => setFormData({ ...formData, party: { ...formData.party, adults: parseInt(e.target.value) || 1 }})} className="w-full px-2 py-1.5 border border-gray-300 rounded" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Children (2-16)</label>
                                <input type="number" min="0" max="10" value={formData.party.children} onChange={e => setFormData({ ...formData, party: { ...formData.party, children: parseInt(e.target.value) || 0 }})} className="w-full px-2 py-1.5 border border-gray-300 rounded" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Infants (&lt;2)</label>
                                <input type="number" min="0" max="5" value={formData.party.infants} onChange={e => setFormData({ ...formData, party: { ...formData.party, infants: parseInt(e.target.value) || 0 }})} className="w-full px-2 py-1.5 border border-gray-300 rounded" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Dogs (max 2)</label>
                                <input type="number" min="0" max="2" value={formData.party.dogs} onChange={e => setFormData({ ...formData, party: { ...formData.party, dogs: parseInt(e.target.value) || 0 }})} className="w-full px-2 py-1.5 border border-gray-300 rounded" />
                            </div>
                        </div>
                    </div>

                    {/* Budget & Alerts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">💰 Max Budget (optional)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-400">£</span>
                                <input
                                    type="number"
                                    value={formData.budgetMax || ''}
                                    onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value ? (parseInt(e.target.value) || null) : null })}
                                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md"
                                    placeholder="e.g., 2000"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">🔔 Alert Setting</label>
                            <select
                                value={formData.alertSensitivity}
                                onChange={(e) => setFormData({ ...formData, alertSensitivity: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                                <option value="INSTANT">Instant (Recommended)</option>
                                <option value="DIGEST">Daily Digest</option>
                                <option value="EXCEPTIONAL_ONLY">Deals Only (&gt;20%)</option>
                            </select>
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowFilters(!showFilters)}
                            className="text-sm text-green-700 hover:text-green-800 font-semibold"
                        >
                            {showFilters ? '− Hide' : '+ Show'} Advanced Cabin Filters
                        </button>
                    </div>

                    {showFilters && (
                        <div className="p-4 border border-green-100 rounded-lg bg-green-50 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">Prefer Cabin Tiers</label>
                                <div className="flex flex-wrap gap-2">
                                    {CABIN_TIERS.map(tier => (
                                        <button
                                            key={tier}
                                            type="button"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                cabinTiers: prev.cabinTiers.includes(tier) ? prev.cabinTiers.filter(t => t !== tier) : [...prev.cabinTiers, tier]
                                            }))}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${formData.cabinTiers.includes(tier) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'}`}
                                        >
                                            {tier}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">Min Bedrooms</label>
                                    <select
                                        value={formData.minBedrooms}
                                        onChange={e => setFormData({ ...formData, minBedrooms: parseInt(e.target.value) || 1 })}
                                        className="px-3 py-1 border border-gray-300 rounded"
                                    >
                                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+ Bedrooms</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.isPetFriendlyOnly}
                                        onChange={e => setFormData({ ...formData, isPetFriendlyOnly: e.target.checked })}
                                        className="h-4 w-4 text-green-600 rounded"
                                    />
                                    <span className="ml-2 text-sm text-gray-900">Pet Friendly Only 🐾</span>
                                </div>
                            </div>
                        </div>
                    )}
                </form>

                <div className="p-6 border-t border-gray-200 flex justify-between bg-gray-50 rounded-b-lg">
                    <button
                        onClick={onBack}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={createMutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-700 rounded-md hover:bg-green-800 shadow-md disabled:opacity-50"
                    >
                        {createMutation.isPending ? 'Saving...' : (initialData ? 'Update Watcher' : 'Create Watcher')}
                    </button>
                </div>
            </div>
        </div>
    );
}
