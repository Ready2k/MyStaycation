import React, { useState } from 'react';
import { format } from 'date-fns';

interface SearchResult {
    provider: string;
    location: string;
    accommodationName: string;
    priceGbp: number;
    durationNights: number;
    dateStart: string;
    uRL: string;
}

interface ResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    results: SearchResult[];
    isLoading: boolean;
    profileName: string;
}

export function ResultsModal({ isOpen, onClose, results, isLoading, profileName }: ResultsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
                    <div className="sm:flex sm:items-start justify-between mb-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                            Latest Deals for "{profileName}"
                        </h3>
                        <button
                            onClick={onClose}
                            className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                        >
                            <span className="sr-only">Close</span>
                            <span className="text-2xl">&times;</span>
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No deals found at the moment. Try adjusting your watcher settings.
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {results.map((result, idx) => (
                                <a
                                    key={idx}
                                    href={result.uRL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white group"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                {result.provider}
                                            </span>
                                            <h4 className="mt-2 text-sm font-bold text-gray-900 group-hover:text-primary-600">
                                                {result.accommodationName}
                                            </h4>
                                            <p className="text-xs text-gray-500">{result.location}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-gray-900">£{result.priceGbp}</p>
                                            <p className="text-xs text-green-600 font-medium">Available</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center text-xs text-gray-500">
                                        <span className="mr-3">📅 {format(new Date(result.dateStart), 'd MMM')}</span>
                                        <span>🌙 {result.durationNights} nights</span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
