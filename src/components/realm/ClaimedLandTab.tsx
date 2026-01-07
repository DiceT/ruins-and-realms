import React from 'react';
import { useRealmStore } from '../../stores/realm';

const ClaimedLandTab: React.FC = () => {
    const claimedLand = useRealmStore(state => state.claimedLand);

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-amber-500 font-bold uppercase tracking-wider text-sm">Claimed Land Log</h2>
                    <span className="text-xs text-slate-400">Total Owned: {claimedLand.length} Plots</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900/50 text-xs uppercase text-slate-500 font-semibold">
                            <tr>
                                <th className="px-6 py-3">Plot Tag</th>
                                <th className="px-6 py-3">Land Type</th>
                                <th className="px-6 py-3">Rank (Mod)</th>
                                <th className="px-6 py-3">Taxes (SC)</th>
                                <th className="px-6 py-3">Building Points</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {claimedLand.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                                        No land claimed yet.
                                    </td>
                                </tr>
                            ) : (
                                claimedLand.map((plot) => (
                                    <tr key={plot.plotTag} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-amber-500">{plot.plotTag}</div>
                                            <div className="text-[10px] text-slate-500">Claimed Year {plot.claimedOn}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>{plot.landType}</div>
                                            <div className="flex gap-1 mt-1 flex-wrap w-32">
                                                {plot.providedTags.map(tag => (
                                                    <span key={tag} className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-amber-900/60 border border-slate-800">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold">{plot.rank + plot.rankModifier}</span>
                                            <span className="text-slate-500 text-xs ml-1">(Rank {plot.rank} + {plot.rankModifier})</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">
                                            {plot.taxesInSilver} SC
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-slate-900 h-2 rounded-full w-24 overflow-hidden border border-slate-700">
                                                    <div
                                                        className="h-full bg-blue-500/60"
                                                        style={{ width: `${(plot.buildingPoints.used / plot.buildingPoints.total) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-400">
                                                    {plot.buildingPoints.used}/{plot.buildingPoints.total}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => console.log('View on map:', plot.hexCoordinates)}
                                                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 px-3 py-1 rounded transition-colors"
                                            >
                                                View Map
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

export default ClaimedLandTab;
