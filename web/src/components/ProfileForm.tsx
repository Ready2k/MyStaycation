import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../services/api';

interface ProfileFormData {
    // Core
    name: string;
    partySizeAdults: number;
    partySizeChildren: number;
    pets: boolean;
    petsNumber: number;
    budgetCeilingGbp?: number | string; // Allow string from form input
    enabled: boolean;

    // Dates
    flexType: 'FIXED' | 'RANGE' | 'FLEXI';
    dateStart?: string;
    dateEnd?: string;
    durationNightsMin: number;
    durationNightsMax: number;
    stayPattern: 'ANY' | 'MIDWEEK' | 'WEEKEND' | 'FULL_WEEK';
    schoolHolidays: 'ALLOW' | 'AVOID' | 'ONLY';
    peakTolerance: 'OFFPEAK_ONLY' | 'MIXED' | 'PEAK_OK';

    // Accommodation
    accommodationType: 'ANY' | 'LODGE' | 'CARAVAN' | 'APARTMENT' | 'COTTAGE' | 'HOTEL';
    tier: 'STANDARD' | 'PREMIUM' | 'LUXURY';
    minBedrooms: number;

    // Accessibility
    stepFreeAccess: boolean;
    accessibleBathroom: boolean;

    // Alerts
    alertSensitivity: 'INSTANT' | 'DIGEST' | 'EXCEPTIONAL_ONLY';

    // Metadata
    region?: string;
    maxResults: number;
    sortOrder: 'PRICE_ASC' | 'PRICE_DESC' | 'DATE_ASC';
    enabledProviders: string[];
    parkIds: string[];
    parkUrls?: string[];
}


const initialFormState: ProfileFormData = {
    name: '',
    partySizeAdults: 2,
    partySizeChildren: 0,
    pets: false,
    petsNumber: 0,
    enabled: true,

    flexType: 'RANGE',
    durationNightsMin: 3,
    durationNightsMax: 7,
    stayPattern: 'ANY',
    schoolHolidays: 'ALLOW',
    peakTolerance: 'MIXED',

    accommodationType: 'ANY',
    tier: 'STANDARD',
    minBedrooms: 0,

    stepFreeAccess: false,
    accessibleBathroom: false,

    alertSensitivity: 'INSTANT',

    region: '',
    maxResults: 50,
    sortOrder: 'PRICE_ASC',
    enabledProviders: [], // Default to all providers
    parkIds: [],
    parkUrls: []
};

interface ProfileFormProps {
    initialData?: any;
    onSuccess: () => void;
    onCancel: () => void;
}

export function ProfileForm({ initialData, onSuccess, onCancel }: ProfileFormProps) {
    const [formData, setFormData] = useState<ProfileFormData>(initialFormState);
    const [activeSection, setActiveSection] = useState<string | null>('accommodation'); // Example default

    const toggleSection = (section: string) => {
        setActiveSection(activeSection === section ? null : section);
    };

    const queryClient = useQueryClient();

    // Fetch available providers
    const { data: providersData } = useQuery({
        queryKey: ['providers'],
        queryFn: async () => {
            const { data } = await api.get('/providers');
            return data;
        }
    });

    const availableProviders = providersData?.providers || [];

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialFormState, // Ensure defaults for new fields
                ...initialData,
                dateStart: initialData.dateStart ? initialData.dateStart.split('T')[0] : '',
                dateEnd: initialData.dateEnd ? initialData.dateEnd.split('T')[0] : '',
                enabledProviders: initialData.enabledProviders || []
            });
        }
    }, [initialData]);

    const mutation = useMutation({
        mutationFn: async (data: ProfileFormData) => {
            const payload = { ...data };
            if (!payload.dateStart) delete payload.dateStart;
            if (!payload.dateEnd) delete payload.dateEnd;

            // Convert budgetCeilingGbp to number or undefined
            if (payload.budgetCeilingGbp === '' || payload.budgetCeilingGbp === undefined) {
                delete (payload as any).budgetCeilingGbp;
            } else if (typeof payload.budgetCeilingGbp === 'string') {
                (payload as any).budgetCeilingGbp = parseFloat(payload.budgetCeilingGbp);
            }

            console.log('Saving profile with payload:', payload);

            if (initialData?.id) {
                const { data: res } = await api.put(`/profiles/${initialData.id}`, payload);
                return res;
            } else {
                const { data: res } = await api.post('/profiles', payload);
                return res;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            onSuccess();
        },
        onError: (error: any) => {
            console.error('Profile save error:', error);
            console.error('Error response:', error.response?.data);
            alert(`Failed to save watcher: ${error.response?.data?.message || error.message}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    const SectionHeader = ({ title, id }: { title: string, id: string }) => (
        <button
            type="button"
            onClick={() => toggleSection(id)}
            className="w-full flex justify-between items-center py-3 text-left font-medium text-gray-900 border-b border-gray-100 focus:outline-none"
        >
            <span>{title}</span>
            <span>{activeSection === id ? '−' : '+'}</span>
        </button>
    );

    const handleImportUrl = (url: string) => {
        try {
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            const updates: Partial<ProfileFormData> = {};
            let message = '';

            // Hoseasons Logic
            if (url.includes('hoseasons') || url.includes('awaze')) {
                const adult = params.get('adult');
                const child = params.get('child');
                const pets = params.get('pets');
                const start = params.get('start'); // DD-MM-YYYY
                const nights = params.get('nights');
                const region = params.get('regionName');

                if (adult) updates.partySizeAdults = parseInt(adult);
                if (child) updates.partySizeChildren = parseInt(child);

                // Hoseasons pets=1 usually means YES, count unspecified often.
                // If numeric > 0, treat as count.
                if (pets) {
                    const petCount = parseInt(pets);
                    updates.pets = petCount > 0;
                    updates.petsNumber = petCount;
                }

                if (start) {
                    // Convert DD-MM-YYYY to YYYY-MM-DD
                    const parts = start.split('-');
                    if (parts.length === 3) {
                        const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        if (!isNaN(date.getTime())) {
                            updates.dateStart = date.toISOString().split('T')[0];
                        }
                    }
                }

                if (nights) {
                    const n = parseInt(nights);
                    updates.durationNightsMin = n;
                    updates.durationNightsMax = n; // Fixed duration usually
                }

                if (region) updates.region = region;

                // Extract placesId (for specific park monitoring)
                const placesId = params.get('placesId');
                if (placesId) {
                    // Append to existing list if unique
                    const currentIds = new Set(formData.parkIds || []);
                    if (!currentIds.has(placesId)) {
                        const newParkIds = [...(formData.parkIds || []), placesId];
                        const newParkUrls = [...(formData.parkUrls || []), url];
                        updates.parkIds = newParkIds;
                        updates.parkUrls = newParkUrls;
                        updates.enabledProviders = ['hoseasons']; // Ensure provider is enabled
                        message = `Added Park ID: ${placesId} to monitoring list`;
                    } else {
                        message = `Park ID: ${placesId} is already in the list`;
                    }
                } else {
                    // Generic URL - just update params
                    message = 'Imported search parameters (Dates/Party) from URL';
                    // Do NOT clear parkIds, user might strictly want to keep their list but update dates
                }
            }

            // Haven Logic (Basic support)
            else if (url.includes('haven')) {
                const adults = params.get('adults');
                const children = params.get('children');
                const arrival = params.get('arrivalDate');
                const duration = params.get('duration');

                if (adults) updates.partySizeAdults = parseInt(adults);
                if (children) updates.partySizeChildren = parseInt(children);
                if (duration) {
                    const n = parseInt(duration);
                    updates.durationNightsMin = n;
                    updates.durationNightsMax = n;
                }
                if (arrival) {
                    // Check format (usually YYYY-MM-DD or DD-MM-YYYY)
                    if (arrival.includes('-')) {
                        // Assuming standard ISO for now, or Date parsing
                        const date = new Date(arrival);
                        if (!isNaN(date.getTime())) {
                            updates.dateStart = date.toISOString().split('T')[0];
                        }
                    }
                }
                message = 'Imported settings from Haven URL';
            }

            if (Object.keys(updates).length > 0) {
                setFormData(prev => ({ ...prev, ...updates }));
                alert(message);
            } else {
                alert('Could not extract details from this URL. Try a search result page URL.');
            }
        } catch (e) {
            console.error(e);
            alert('Invalid URL format');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    {initialData ? 'Edit Watcher' : 'New Holiday Watcher'}
                </h2>

                {/* --- URL IMPORT --- */}
                {!initialData && (
                    <div className="mb-6 bg-blue-50 p-4 rounded-md border border-blue-100">
                        <label className="block text-sm font-medium text-blue-900 mb-1">Import from Provider URL</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-grow rounded-md border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                placeholder="Paste a Hoseasons or Haven search URL here..."
                                onPaste={(e) => {
                                    const pasted = e.clipboardData.getData('text');
                                    // Optional: auto-import on paste? better to wait for click
                                }}
                                id="import-url-input"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const input = document.getElementById('import-url-input') as HTMLInputElement;
                                    if (input?.value) handleImportUrl(input.value);
                                }}
                                className="px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                            >
                                Import
                            </button>
                        </div>
                        <p className="mt-1 text-xs text-blue-700">
                            Paste a search results page URL to auto-fill guests, dates, and region.
                        </p>
                        {formData.parkIds && formData.parkIds.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs font-semibold text-gray-700 mb-2">Monitored Parks:</p>
                                <div className="flex flex-wrap gap-2">
                                    {formData.parkIds.map((id, index) => (
                                        <div key={`${id}-${index}`} className="flex items-center text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200">
                                            <span className="mr-1">ID: {id}</span>
                                            {formData.parkUrls?.[index] && (
                                                <a
                                                    href={formData.parkUrls[index]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-800 hover:underline mx-1 font-semibold"
                                                    title={formData.parkUrls[index]}
                                                >
                                                    (Link)
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({
                                                    ...prev,
                                                    parkIds: prev.parkIds.filter((_, i) => i !== index),
                                                    parkUrls: prev.parkUrls?.filter((_, i) => i !== index)
                                                }))}
                                                className="text-green-800 hover:text-red-600 font-bold ml-1"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, parkIds: [] }))}
                                        className="text-xs text-red-600 underline self-center ml-2"
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )
                }

                {/* --- CORE SECTION (Always Visible) --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Watcher Name</label>
                        <input
                            type="text"
                            required
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                            placeholder="e.g. Summer 2024 Cornwall"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Region / Area</label>
                        <input
                            type="text"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                            placeholder="e.g. Cornwall, Devon, Lake District"
                            value={formData.region || ''}
                            onChange={e => setFormData({ ...formData, region: e.target.value })}
                        />
                        <p className="mt-1 text-xs text-gray-500">Leave empty for any location.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Adults</label>
                        <input type="number" min="1" required className="w-full rounded-md border-gray-300 shadow-sm"
                            value={formData.partySizeAdults} onChange={e => setFormData({ ...formData, partySizeAdults: parseInt(e.target.value) })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Children</label>
                        <input type="number" min="0" className="w-full rounded-md border-gray-300 shadow-sm"
                            value={formData.partySizeChildren} onChange={e => setFormData({ ...formData, partySizeChildren: parseInt(e.target.value) })} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input type="date" className="w-full rounded-md border-gray-300 shadow-sm"
                            value={formData.dateStart || ''} onChange={e => setFormData({ ...formData, dateStart: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input type="date" className="w-full rounded-md border-gray-300 shadow-sm"
                            value={formData.dateEnd || ''} onChange={e => setFormData({ ...formData, dateEnd: e.target.value })} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Budget (£)</label>
                        <input type="number" min="0" step="10" className="w-full rounded-md border-gray-300 shadow-sm"
                            value={formData.budgetCeilingGbp || ''} onChange={e => setFormData({ ...formData, budgetCeilingGbp: e.target.value ? parseFloat(e.target.value) : undefined })} />
                    </div>

                    <div className="flex items-center pt-6 space-x-4">
                        <label className="flex items-center">
                            <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500"
                                checked={formData.pets} onChange={e => setFormData({ ...formData, pets: e.target.checked })} />
                            <span className="ml-2 text-sm text-gray-900">Pets Allowed 🐾</span>
                        </label>
                    </div>
                </div>
            </div >

            {/* --- ADVANCED ACCOMMODATION --- */}
            < div className="px-6 py-2 bg-gray-50 border-b border-gray-100" >
                <SectionHeader title="Accommodation Preference" id="accommodation" />
                {
                    activeSection === 'accommodation' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 pt-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select className="w-full rounded-md border-gray-300 shadow-sm"
                                    value={formData.accommodationType}
                                    onChange={e => setFormData({ ...formData, accommodationType: e.target.value as any })}>
                                    <option value="ANY">Any Type</option>
                                    <option value="LODGE">Lodge</option>
                                    <option value="CARAVAN">Caravan</option>
                                    <option value="APARTMENT">Apartment</option>
                                    <option value="COTTAGE">Cottage</option>
                                    <option value="HOTEL">Hotel</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quality Tier</label>
                                <select className="w-full rounded-md border-gray-300 shadow-sm"
                                    value={formData.tier}
                                    onChange={e => setFormData({ ...formData, tier: e.target.value as any })}>
                                    <option value="STANDARD">Standard</option>
                                    <option value="PREMIUM">Premium</option>
                                    <option value="LUXURY">Luxury</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Min Bedrooms</label>
                                <input type="number" min="0" className="w-full rounded-md border-gray-300 shadow-sm"
                                    value={formData.minBedrooms} onChange={e => setFormData({ ...formData, minBedrooms: parseInt(e.target.value) })} />
                            </div>
                        </div>
                    )
                }
            </div >

            {/* --- DURATION & FLEXIBILITY --- */}
            < div className="px-6 py-2 bg-gray-50 border-b border-gray-100" >
                <SectionHeader title="Duration & Flexibility" id="flexibility" />
                {
                    activeSection === 'flexibility' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 pt-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Min Nights</label>
                                <input type="number" min="1" className="w-full rounded-md border-gray-300 shadow-sm"
                                    value={formData.durationNightsMin} onChange={e => setFormData({ ...formData, durationNightsMin: parseInt(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max Nights</label>
                                <input type="number" min="1" className="w-full rounded-md border-gray-300 shadow-sm"
                                    value={formData.durationNightsMax} onChange={e => setFormData({ ...formData, durationNightsMax: parseInt(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Stay Pattern</label>
                                <select className="w-full rounded-md border-gray-300 shadow-sm"
                                    value={formData.stayPattern}
                                    onChange={e => setFormData({ ...formData, stayPattern: e.target.value as any })}>
                                    <option value="ANY">Any Start Day</option>
                                    <option value="MIDWEEK">Midweek (Mon-Fri)</option>
                                    <option value="WEEKEND">Weekend (Fri-Mon)</option>
                                    <option value="FULL_WEEK">Full Week (Sat-Sat)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">School Holidays</label>
                                <select className="w-full rounded-md border-gray-300 shadow-sm"
                                    value={formData.schoolHolidays}
                                    onChange={e => setFormData({ ...formData, schoolHolidays: e.target.value as any })}>
                                    <option value="ALLOW">Allow (Pricey)</option>
                                    <option value="AVOID">Avoid (Cheaper)</option>
                                    <option value="ONLY">School Hols Only</option>
                                </select>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* --- PETS & ACCESS --- */}
            < div className="px-6 py-2 bg-gray-50 border-b border-gray-100" >
                <SectionHeader title="Pets & Accessibility" id="access" />
                {
                    activeSection === 'access' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 pt-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Pets</label>
                                <input type="number" min="0" className="w-full rounded-md border-gray-300 shadow-sm"
                                    disabled={!formData.pets}
                                    value={formData.petsNumber} onChange={e => setFormData({ ...formData, petsNumber: parseInt(e.target.value) })} />
                            </div>
                            <div className="flex flex-col space-y-3 pt-6">
                                <label className="flex items-center">
                                    <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500"
                                        checked={formData.stepFreeAccess} onChange={e => setFormData({ ...formData, stepFreeAccess: e.target.checked })} />
                                    <span className="ml-2 text-sm text-gray-900">Step-free Access Required</span>
                                </label>
                                <label className="flex items-center">
                                    <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500"
                                        checked={formData.accessibleBathroom} onChange={e => setFormData({ ...formData, accessibleBathroom: e.target.checked })} />
                                    <span className="ml-2 text-sm text-gray-900">Accessible Bathroom Required</span>
                                </label>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* --- ALERT SETTINGS --- */}
            < div className="px-6 py-2 bg-gray-50" >
                <SectionHeader title="Alert Preferences" id="alerts" />
                {
                    activeSection === 'alerts' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 pt-2">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alert Sensitivity</label>
                                <select className="w-full rounded-md border-gray-300 shadow-sm"
                                    value={formData.alertSensitivity}
                                    onChange={e => setFormData({ ...formData, alertSensitivity: e.target.value as any })}>
                                    <option value="INSTANT">Instant (Every price drop)</option>
                                    <option value="DIGEST">Daily Digest</option>
                                    <option value="EXCEPTIONAL_ONLY">Exceptional Deals Only (&gt;20% drop)</option>
                                </select>
                                <p className="mt-1 text-xs text-gray-500">
                                    "Exceptional Only" reduces noise and only emails you when we find significant savings.
                                </p>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* --- PROVIDER SELECTION --- */}
            < div className="px-6 py-2 bg-gray-50 border-t border-gray-100" >
                <SectionHeader title="Provider Selection" id="providers" />
                {
                    activeSection === 'providers' && (
                        <div className="pb-4 pt-2">
                            <p className="text-sm text-gray-600 mb-3">
                                Select which holiday providers to monitor for this watcher:
                            </p>
                            <div className="space-y-2">
                                {availableProviders.map((provider: { code: string; name: string }) => (
                                    <label key={provider.code} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            className="rounded text-primary-600 focus:ring-primary-500"
                                            checked={formData.enabledProviders.includes(provider.code)}
                                            onChange={e => {
                                                const updated = e.target.checked
                                                    ? [...formData.enabledProviders, provider.code]
                                                    : formData.enabledProviders.filter(p => p !== provider.code);
                                                setFormData({ ...formData, enabledProviders: updated });
                                            }}
                                        />
                                        <span className="ml-2 text-sm text-gray-900">{provider.name}</span>
                                    </label>
                                ))}
                            </div>
                            {formData.enabledProviders.length === 0 && (
                                <p className="mt-2 text-xs text-amber-600">
                                    ⚠️ No providers selected. All providers will be searched by default.
                                </p>
                            )}
                        </div>
                    )
                }
            </div >

            {/* --- ADVANCED FILTERING --- */}
            < div className="px-6 py-2 bg-gray-50 border-t border-gray-100" >
                <SectionHeader title="Advanced Search Settings" id="advanced" />
                {
                    activeSection === 'advanced' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 pt-2">

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max Results</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    className="w-full rounded-md border-gray-300 shadow-sm"
                                    value={formData.maxResults}
                                    onChange={e => setFormData({ ...formData, maxResults: parseInt(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                                <select className="w-full rounded-md border-gray-300 shadow-sm"
                                    value={formData.sortOrder}
                                    onChange={e => setFormData({ ...formData, sortOrder: e.target.value as any })}>
                                    <option value="PRICE_ASC">Price: Low to High</option>
                                    <option value="PRICE_DESC">Price: High to Low</option>
                                    <option value="DATE_ASC">Date: Earliest First</option>
                                </select>
                            </div>
                        </div>
                    )
                }
            </div >

            {
                mutation.isError && (
                    <div className="p-6 pb-0">
                        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                            Error saving watcher. Please try again.
                        </div>
                    </div>
                )
            }

            < div className="p-6 flex justify-end space-x-3 bg-gray-50 border-t border-gray-100" >
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                    {mutation.isPending ? 'Saving...' : (initialData ? 'Update Watcher' : 'Create Watcher')}
                </button>
            </div >
        </form >
    );
}
