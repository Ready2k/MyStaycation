import React, { useState } from 'react';
import { format } from 'date-fns';

export interface SearchResult {
    provider: string;
    location: string;
    accommodationName: string;
    priceGbp: number;
    durationNights: number;
    dateStart: string;
    uRL: string;
    confidence: 'MATCH_STRONG' | 'MATCH_WEAK' | 'MATCH_UNKNOWN' | 'MISMATCH';
    reasons?: {
        passed: { code: string; message: string }[];
        failed: { code: string; message: string }[];
    };
}

interface ResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    results: SearchResult[];
    isLoading: boolean;
    profileName: string;
}

const ConfidenceBadge = ({ confidence }: { confidence: string }) => {
    const styles = {
        'MATCH_STRONG': 'bg-green-100 text-green-800',
        'MATCH_WEAK': 'bg-yellow-100 text-yellow-800',
        'MATCH_UNKNOWN': 'bg-gray-100 text-gray-800',
        'MISMATCH': 'bg-red-100 text-red-800',
    };
    const labels = {
        'MATCH_STRONG': 'Great Match',
        'MATCH_WEAK': 'Close Match',
        'MATCH_UNKNOWN': 'Unverified',
        'MISMATCH': 'Mismatch',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[confidence as keyof typeof styles] || styles['MATCH_UNKNOWN']}`}>
            {labels[confidence as keyof typeof labels] || confidence}
        </span>
    );
};

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
                            Live Preview for "{profileName}"
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
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                            <p className="text-sm text-gray-500">Checking providers real-time...</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-600 mb-2">🔄 Monitoring job queued!</p>
                            <p className="text-sm text-gray-500">
                                Results are being collected in the background. Check the chart in a few moments to see price data.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {results.map((result, idx) => (
                                <a
                                    key={idx}
                                    href={result.uRL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white group flex flex-col h-full"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                            {result.provider}
                                        </span>
                                        <ConfidenceBadge confidence={result.confidence} />
                                    </div>

                                    <h4 className="flex-grow mt-2 text-sm font-bold text-gray-900 group-hover:text-primary-600 line-clamp-2">
                                        {result.accommodationName}
                                    </h4>
                                    <p className="text-xs text-gray-500 mb-2">{result.location}</p>

                                    <div className="flex justify-between items-end mt-auto">
                                        <div>
                                            <p className="text-lg font-bold text-gray-900">£{result.priceGbp}</p>
                                            <div className="flex items-center text-xs text-gray-500 mt-1">
                                                {result.dateStart && (
                                                    <span className="mr-3">📅 {format(new Date(result.dateStart), 'd MMM')}</span>
                                                )}
                                                <span>🌙 {result.durationNights}n</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Failure Reasons (if any) */}
                                    {result.reasons?.failed && result.reasons.failed.length > 0 && (
                                        <div className="mt-3 pt-2 border-t border-gray-100">
                                            <p className="text-[10px] uppercase font-bold text-red-600 mb-1">Mismatches:</p>
                                            <ul className="text-xs text-red-500 list-disc pl-3">
                                                {result.reasons.failed.slice(0, 2).map((r, i) => (
                                                    <li key={i}>{r.message}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
