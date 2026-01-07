import React from 'react';
import { useRealmStore } from '../../stores/realm';

const BuildingsTab: React.FC = () => {
    const buildings = useRealmStore(state => state.buildings);
    const getTotalBuildingIncome = useRealmStore(state => state.getTotalBuildingIncome);
    const getAvailableWorkers = useRealmStore(state => state.getAvailableWorkers);

    const operationalCount = buildings.filter(b => b.operational).length;
    const totalIncome = getTotalBuildingIncome();

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-amber-500 font-bold uppercase tracking-wider text-sm">Building Register</h2>
                    <div className="text-xs text-slate-400 space-x-3">
                        <span>Operational: {operationalCount}/{buildings.length}</span>
                        <span className="text-emerald-400">Total Income: {totalIncome} GC</span>
                        <span>Workers Avail: {getAvailableWorkers()}</span>
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
                                <th className="px-6 py-3">Income</th>
                                <th className="px-6 py-3">Workers</th>
                                <th className="px-6 py-3">HP</th>
                                <th className="px-6 py-3">Tags</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {buildings.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500 italic">
                                        No industrial or specialized buildings constructed.
                                    </td>
                                </tr>
                            ) : (
                                buildings.map((b) => (
                                    <tr key={b.instanceId} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 font-mono text-slate-400">{b.plotTag}</td>
                                        <td className="px-6 py-4 font-semibold text-slate-200">{b.name}</td>
                                        <td className="px-6 py-4">{b.level}</td>
                                        <td className="px-6 py-4 text-emerald-400">+{b.rankMod}</td>
                                        <td className="px-6 py-4">{b.income}</td>
                                        <td className="px-6 py-4">
                                            <span className={b.workers.allocated < b.workers.required ? 'text-red-400' : 'text-emerald-400'}>
                                                {b.workers.allocated}/{b.workers.required}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${b.damaged ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${(b.hp.current / b.hp.max) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs">{b.hp.current}/{b.hp.max}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {b.providedTags.map(tag => (
                                                    <span key={tag} className="text-[10px] bg-slate-900 border border-slate-700 px-1 rounded text-slate-400">
                                                        {tag}
                                                    </span>
                                                ))}
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

export default BuildingsTab;
