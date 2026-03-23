import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { format } from 'date-fns';
import { ResultsModal, SearchResult } from './ResultsModal';
import { ConfirmationModal } from './ConfirmationModal';

interface LastFetchRun {
    status: 'OK' | 'ERROR' | 'BLOCKED' | 'PARSE_FAILED';
    providerStatus: string | null;
    errorMessage: string | null;
    finishedAt: string | null;
}

interface Profile {
    id: string;
    name: string;
    partySizeAdults: number;
    partySizeChildren: number;
    dateStart?: string;
    dateEnd?: string;
    durationNightsMin: number;
    durationNightsMax: number;
    budgetCeilingGbp?: number;
    enabled: boolean;
    pets: boolean;
    provider?: {
        code: string;
        name: string;
    };
    region?: string;
    lastFetchRun?: LastFetchRun | null;
}

const PROVIDER_COLOURS: Record<string, string> = {
    haven:       'bg-blue-100 text-blue-800',
    hoseasons:   'bg-green-100 text-green-800',
    centerparcs: 'bg-emerald-100 text-emerald-800',
    butlins:     'bg-red-100 text-red-800',
    parkdean:    'bg-orange-100 text-orange-800',
    awayresorts: 'bg-purple-100 text-purple-800',
};

function LastCheckedBadge({ run }: { run?: LastFetchRun | null }) {
    if (!run?.finishedAt) {
        return <span className="text-xs text-gray-400">Not yet checked</span>;
    }

    const diff = Date.now() - new Date(run.finishedAt).getTime();
    const hours = Math.floor(diff / 3600000);
    const label = hours < 1 ? 'Just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;

    const isOk = run.status === 'OK';
    const dotColour = isOk ? 'bg-green-500' : run.status === 'BLOCKED' ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <span
            className="flex items-center gap-1.5 text-xs text-gray-500"
            title={isOk
                ? `Last checked: ${new Date(run.finishedAt).toLocaleString()}`
                : `Error: ${run.errorMessage || run.providerStatus || run.status}`}
        >
            <span className={`w-2 h-2 rounded-full ${dotColour}`} />
            {label}
            {!isOk && <span className="text-red-500">({run.status})</span>}
        </span>
    );
}

export function ProfileList({
    onEdit,
    onCreateNew,
}: {
    onEdit: (profile: Profile) => void;
    onCreateNew?: () => void;
}) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isSearching, setIsSearching] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeProfileName, setActiveProfileName] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
    const [mutationError, setMutationError] = useState('');

    const searchMutation = useMutation({
        mutationFn: async (profileId: string) => {
            const { data } = await api.post(`/search/${profileId}/run`);
            return data.results || [];
        },
        onSuccess: (results) => {
            const flattenedResults: SearchResult[] = results.map((item: any) => ({
                provider: item.providerKey || 'Unknown',
                location: item.location || item.parkId || 'Unknown Location',
                accommodationName: item.propertyName || item.accommodationType || 'Accommodation',
                priceGbp: item.price?.totalGbp || 0,
                durationNights: item.stayNights || 0,
                dateStart: item.stayStartDate || '',
                uRL: item.sourceUrl || '',
                confidence: item.confidence || 0,
                matchDetails: item.matchDetails,
                reasons: item.reasons || [],
            }));
            setSearchResults(flattenedResults);
            setModalOpen(true);
            setIsSearching(null);
        },
        onError: () => {
            setMutationError('Search failed — please try again.');
            setIsSearching(null);
        },
    });

    const handleSearch = (profileId: string, profileName: string) => {
        setMutationError('');
        setIsSearching(profileId);
        setActiveProfileName(profileName);
        setModalOpen(true);
        setSearchResults([]);
        searchMutation.mutate(profileId);
    };

    const { data: profiles, isLoading, error } = useQuery({
        queryKey: ['profiles'],
        queryFn: async () => {
            const { data } = await api.get<Profile[]>('/profiles');
            return data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/profiles/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
        },
        onError: () => {
            setMutationError('Failed to delete watcher — please try again.');
        },
    });

    const toggleEnabledMutation = useMutation({
        mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
            await api.put(`/profiles/${id}`, { enabled });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
        },
        onError: () => {
            setMutationError('Failed to update watcher status — please try again.');
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12 text-red-600 text-sm">
                Could not load watchers. Please refresh the page.
            </div>
        );
    }

    if (!profiles?.length) {
        return (
            <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="text-5xl mb-4">🏖️</div>
                <h3 className="text-base font-semibold text-gray-900">No watchers yet</h3>
                <p className="mt-1 text-sm text-gray-500 max-w-xs mx-auto">
                    Create a watcher and we'll track prices across your chosen provider and alert you when a deal appears.
                </p>
                {onCreateNew && (
                    <button
                        onClick={onCreateNew}
                        className="mt-5 inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
                    >
                        + Create your first watcher
                    </button>
                )}
            </div>
        );
    }

    return (
        <>
            {mutationError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700 flex items-center justify-between">
                    {mutationError}
                    <button onClick={() => setMutationError('')} className="text-red-400 hover:text-red-600 ml-4">✕</button>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {profiles.map((profile) => (
                    <div
                        key={profile.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col"
                    >
                        <div className="p-5 flex-1 flex flex-col">
                            {/* Header: name + provider badge + status toggle */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-semibold text-gray-900 leading-snug truncate">
                                        {profile.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {profile.provider && (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PROVIDER_COLOURS[profile.provider.code] ?? 'bg-gray-100 text-gray-700'}`}>
                                                {profile.provider.name}
                                            </span>
                                        )}
                                        {profile.region && (
                                            <span className="text-xs text-gray-400">{profile.region}</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleEnabledMutation.mutate({ id: profile.id, enabled: !profile.enabled })}
                                    disabled={toggleEnabledMutation.isPending}
                                    title={profile.enabled ? 'Click to pause monitoring' : 'Click to resume monitoring'}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                        profile.enabled
                                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${profile.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                                    {profile.enabled ? 'Active' : 'Paused'}
                                </button>
                            </div>

                            {/* Details */}
                            <div className="space-y-1.5 text-sm text-gray-600 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">👥</span>
                                    <span>
                                        {profile.partySizeAdults} adults
                                        {profile.partySizeChildren > 0 && `, ${profile.partySizeChildren} children`}
                                        {profile.pets && ' 🐾'}
                                    </span>
                                </div>
                                {(profile.dateStart || profile.dateEnd) && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">📅</span>
                                        <span>
                                            {profile.dateStart ? format(new Date(profile.dateStart), 'MMM d') : 'Any'}
                                            {' – '}
                                            {profile.dateEnd ? format(new Date(profile.dateEnd), 'MMM d, yyyy') : 'Any'}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="text-base">🌙</span>
                                    <span>
                                        {profile.durationNightsMin === profile.durationNightsMax
                                            ? `${profile.durationNightsMin} nights`
                                            : `${profile.durationNightsMin}–${profile.durationNightsMax} nights`}
                                    </span>
                                </div>
                                {profile.budgetCeilingGbp && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">💰</span>
                                        <span>Max £{profile.budgetCeilingGbp.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>

                            {/* Last checked */}
                            <div className="pt-3 border-t border-gray-100 mt-auto">
                                <LastCheckedBadge run={profile.lastFetchRun} />
                            </div>
                        </div>

                        {/* Action footer */}
                        <div className="px-5 pb-4 flex items-center justify-between gap-2 border-t border-gray-50 pt-3">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => router.push(`/dashboard/profile/${profile.id}`)}
                                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                >
                                    Price History
                                </button>
                                <button
                                    onClick={() => onEdit(profile)}
                                    className="text-gray-500 hover:text-gray-800 text-sm font-medium"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => { setProfileToDelete(profile.id); setDeleteModalOpen(true); }}
                                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                                >
                                    Delete
                                </button>
                            </div>
                            <button
                                onClick={() => handleSearch(profile.id, profile.name)}
                                disabled={isSearching === profile.id}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 shadow-sm disabled:opacity-60 transition-colors"
                            >
                                {isSearching === profile.id ? (
                                    <span className="flex items-center gap-1.5">
                                        <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                                        Checking…
                                    </span>
                                ) : 'Check Now 🔎'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <ResultsModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                results={searchResults}
                isLoading={!!isSearching}
                profileName={activeProfileName}
            />

            <ConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setProfileToDelete(null); }}
                onConfirm={() => { if (profileToDelete) deleteMutation.mutate(profileToDelete); }}
                title="Delete Watcher"
                message="Are you sure you want to delete this watcher? This action cannot be undone."
                confirmLabel="Delete"
                isDestructive={true}
            />
        </>
    );
}
