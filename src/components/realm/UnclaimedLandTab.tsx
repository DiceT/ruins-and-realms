import React from 'react';
import { useRealmStore } from '../../stores/realm';

const UnclaimedLandTab: React.FC = () => {
    const unclaimedLand = useRealmStore(state => state.unclaimedLand);
    const claimLand = useRealmStore(state => state.claimLand);

    const handleClaim = (plotTag: string) => {
        // Logic for claiming would go here (e.g. check cost/conditions)
        // For now, just direct claim
        if (confirm(`Are you sure you want to claim ${plotTag}?`)) {
            claimLand(plotTag);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-amber-500 font-bold uppercase tracking-wider text-sm">Unclaimed Land Log</h2>
                    <span className="text-xs text-slate-400">Total: {unclaimedLand.length} Plots</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900/50 text-xs uppercase text-slate-500 font-semibold">
                            <tr>
                                <th className="px-6 py-3">Plot Tag</th>
                                <th className="px-6 py-3">Land Type</th>
                                <th className="px-6 py-3">Size</th>
                                <th className="px-6 py-3">Rank</th>
                                <th className="px-6 py-3">Details</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {unclaimedLand.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                                        No unclaimed land recorded.
                                    </td>
                                </tr>
                            ) : (
                                unclaimedLand.map((plot) => (
                                    <tr key={plot.plotTag} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 font-mono text-amber-500/80">{plot.plotTag}</td>
                                        <td className="px-6 py-4">{plot.landType}</td>
                                        <td className="px-6 py-4">{plot.size}</td>
                                        <td className="px-6 py-4">{plot.rank} <span className="text-slate-500 text-xs">({plot.rankModifier >= 0 ? '+' : ''}{plot.rankModifier})</span></td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-300">{plot.details}</div>
                                            <div className="flex gap-1 mt-1">
                                                {plot.providedTags.map(tag => (
                                                    <span key={tag} className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleClaim(plot.plotTag)}
                                                className="text-xs bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-400 border border-emerald-800/50 px-3 py-1 rounded transition-colors"
                                            >
                                                Claim
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UnclaimedLandTab;
