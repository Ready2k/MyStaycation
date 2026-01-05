import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { format } from 'date-fns';
import { ResultsModal, SearchResult } from './ResultsModal';
import { ConfirmationModal } from './ConfirmationModal';

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
}

export function ProfileList({ onEdit }: { onEdit: (profile: Profile) => void }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isSearching, setIsSearching] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeProfileName, setActiveProfileName] = useState('');

    // Delete Confirmation State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [profileToDelete, setProfileToDelete] = useState<string | null>(null);

    const searchMutation = useMutation({
        mutationFn: async (profileId: string) => {
            const { data } = await api.post('/search/preview', {
                mode: 'PROFILE_ID',
                profileId: profileId,
                options: {
                    includeDebug: true,
                    includeMismatches: false, // Set true to see failures too
                }
            });

            // Map ProviderPreview[] to SearchResult[]
            const flattenedResults: SearchResult[] = [];
            data.providers.forEach((provider: any) => {
                const addResults = (items: any[]) => {
                    items.forEach(item => {
                        flattenedResults.push({
                            provider: item.providerKey,
                            location: item.location || item.parkId || 'Unknown Location',
                            accommodationName: item.propertyName || item.accommodationType || 'Accommodation',
                            priceGbp: item.price.totalGbp,
                            durationNights: item.stayNights,
                            dateStart: item.stayStartDate,
                            uRL: item.sourceUrl,
                            confidence: item.confidence,
                            reasons: item.reasons
                        });
                    });
                };

                if (provider.results?.matched) addResults(provider.results.matched);
                if (provider.results?.other) addResults(provider.results.other);
            });

            return flattenedResults;
        },
        onSuccess: (results) => {
            setSearchResults(results);
            setModalOpen(true);
            setIsSearching(null);
        },
        onError: () => {
            alert('Search failed. Please try again.');
            setIsSearching(null);
        }
    });

    const handleSearch = (profileId: string, profileName: string) => {
        setIsSearching(profileId);
        setActiveProfileName(profileName);
        setModalOpen(true); // Open modal immediately to show loading state
        setSearchResults([]); // Clear previous results
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
        onError: (err) => {
            console.error("Delete failed:", err);
            alert("Failed to delete watcher. Please try again.");
        }
    });

    if (isLoading) return <div>Loading watchers...</div>;
    if (error) return <div>Error loading profiles</div>;
    if (!profiles?.length) return (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No watchers defined</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new holiday watcher.</p>
        </div>
    );

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
                <div key={profile.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">{profile.name}</h3>
                                <p className="text-sm text-gray-500">
                                    {profile.partySizeAdults} Adults{profile.partySizeChildren > 0 && `, ${profile.partySizeChildren} Children`}
                                    {profile.pets && <span className="ml-2" title="Pets Allowed">🐾</span>}
                                </p>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${profile.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                {profile.enabled ? 'Active' : 'Paused'}
                            </span>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-6">
                            {(profile.dateStart || profile.dateEnd) && (
                                <div className="flex items-center">
                                    <span className="w-5 text-center mr-2">📅</span>
                                    {profile.dateStart ? format(new Date(profile.dateStart), 'MMM d') : 'Any'}
                                    {' - '}
                                    {profile.dateEnd ? format(new Date(profile.dateEnd), 'MMM d, yyyy') : 'Any'}
                                </div>
                            )}
                            <div className="flex items-center">
                                <span className="w-5 text-center mr-2">🌙</span>
                                {profile.durationNightsMin} - {profile.durationNightsMax} nights
                            </div>
                            {profile.budgetCeilingGbp && (
                                <div className="flex items-center">
                                    <span className="w-5 text-center mr-2">💰</span>
                                    Max £{profile.budgetCeilingGbp}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => router.push(`/dashboard/profile/${profile.id}`)}
                                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                >
                                    View Chart
                                </button>
                                <button
                                    onClick={() => onEdit(profile)}
                                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => {
                                        setProfileToDelete(profile.id);
                                        setDeleteModalOpen(true);
                                    }}
                                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                                >
                                    Delete
                                </button>
                            </div>
                            <button
                                onClick={() => handleSearch(profile.id, profile.name)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 shadow-sm"
                            >
                                {isSearching === profile.id ? 'Checking...' : 'Check Now 🔎'}
                            </button>
                        </div>
                    </div>
                </div>
            ))}

            <ResultsModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                results={searchResults}
                isLoading={!!isSearching}
                profileName={activeProfileName}
            />

            <ConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setProfileToDelete(null);
                }}
                onConfirm={() => {
                    console.log("Confirm delete for ID:", profileToDelete);
                    if (profileToDelete) {
                        deleteMutation.mutate(profileToDelete);
                    } else {
                        console.error("No profile ID to delete");
                    }
                }}
                title="Delete Watcher"
                message="Are you sure you want to delete this watcher? This action cannot be undone."
                confirmLabel="Delete"
                isDestructive={true}
            />
        </div>
    );
}
