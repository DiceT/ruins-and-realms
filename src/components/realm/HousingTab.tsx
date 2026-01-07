import React from 'react';
import { useRealmStore } from '../../stores/realm';

const HousingTab: React.FC = () => {
    const houses = useRealmStore(state => state.houses);
    const getTotalPopulationCapacity = useRealmStore(state => state.getTotalPopulationCapacity);
    const getTotalWorkers = useRealmStore(state => state.getTotalWorkers);

    const totalCapacity = getTotalPopulationCapacity();
    const currentPop = getTotalWorkers();

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-amber-500 font-bold uppercase tracking-wider text-sm">House & Manor Register</h2>
                    <div className="text-xs text-slate-400 space-x-3">
                        <span>Population: {currentPop}/{totalCapacity}</span>
                        <span className={currentPop >= totalCapacity ? 'text-red-400' : 'text-emerald-400'}>
                            {currentPop >= totalCapacity ? 'Overcrowded' : 'Space Available'}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900/50 text-xs uppercase text-slate-500 font-semibold">
                            <tr>
                                <th className="px-6 py-3">Plot</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Level</th>
                                <th className="px-6 py-3">Rank Mod</th>
                                <th className="px-6 py-3">Capacity</th>
                                <th className="px-6 py-3">Occupants</th>
                                <th className="px-6 py-3">HP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {houses.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">
                                        No housing constructed.
                                    </td>
                                </tr>
                            ) : (
                                houses.map((h) => (
                                    <tr key={h.instanceId} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 font-mono text-slate-400">{h.plotTag}</td>
                                        <td className="px-6 py-4 font-semibold text-slate-200">{h.name}</td>
                                        <td className="px-6 py-4">{h.level}</td>
                                        <td className="px-6 py-4 text-emerald-400">+{h.rankMod}</td>
                                        <td className="px-6 py-4">{h.capacity}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex -space-x-1">
                                                    {[...Array(Math.min(5, h.occupants))].map((_, i) => (
                                                        <div key={i} className="w-2 h-2 rounded-full bg-amber-500 ring-1 ring-slate-800" />
                                                    ))}
                                                    {h.occupants > 5 && <span className="text-[10px] pl-2">+{h.occupants - 5}</span>}
                                                </div>
                                                <span className="text-xs ml-1">{h.occupants}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${h.damaged ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${(h.hp.current / h.hp.max) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
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

export default HousingTab;
