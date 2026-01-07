import React from 'react';
import { useRealmStore } from '../../stores/realm';

const RealmLedgerTab: React.FC = () => {
    const ledger = useRealmStore(state => state.ledger);
    const getNetWellness = useRealmStore(state => state.getNetWellness);
    const netWellness = getNetWellness();

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">

            {/* Top Banner: Income & Wellness */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800 rounded-lg p-5 border border-slate-700 shadow-md">
                    <h2 className="text-amber-500 font-bold mb-4 uppercase tracking-wider text-sm border-b border-slate-700 pb-2">Recent Income</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-slate-300">
                            <thead className="bg-slate-900/50 text-xs text-slate-500">
                                <tr>
                                    <th className="px-2 py-1 text-left">Year</th>
                                    <th className="px-2 py-1">GC</th>
                                    <th className="px-2 py-1">SC</th>
                                    <th className="px-2 py-1">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.incomeHistory.map((inc) => (
                                    <tr key={inc.year} className="border-b border-slate-700/50">
                                        <td className="px-2 py-2 font-mono text-slate-400">{inc.year}</td>
                                        <td className="px-2 py-2 text-center text-yellow-500">{inc.gold}</td>
                                        <td className="px-2 py-2 text-center text-slate-400">{inc.silver}</td>
                                        <td className="px-2 py-2 text-center font-bold text-emerald-400">{inc.totalIncome} GC</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-5 border border-slate-700 shadow-md">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-4">
                        <h2 className="text-amber-500 font-bold uppercase tracking-wider text-sm">Wellness</h2>
                        <div className={`text-lg font-bold ${netWellness >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            Net: {netWellness >= 0 ? '+' : ''}{netWellness}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="text-xs text-emerald-500 font-bold mb-2 uppercase">Positive Modifiers</h3>
                            <ul className="space-y-1">
                                {ledger.wellness.permanent.filter(m => m.value > 0).map((m, i) => (
                                    <li key={i} className="text-sm text-slate-300 flex justify-between">
                                        <span>{m.source}</span>
                                        <span className="text-emerald-400">+{m.value}</span>
                                    </li>
                                ))}
                                {ledger.wellness.permanent.filter(m => m.value > 0).length === 0 && (
                                    <li className="text-xs text-slate-500 italic">None</li>
                                )}
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-xs text-red-500 font-bold mb-2 uppercase">Negative Modifiers</h3>
                            <ul className="space-y-1">
                                {ledger.wellness.permanent.filter(m => m.value < 0).map((m, i) => (
                                    <li key={i} className="text-sm text-slate-300 flex justify-between">
                                        <span>{m.source}</span>
                                        <span className="text-red-400">{m.value}</span>
                                    </li>
                                ))}
                                {ledger.wellness.permanent.filter(m => m.value < 0).length === 0 && (
                                    <li className="text-xs text-slate-500 italic">None</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Aspects Section */}
            <div className="bg-slate-800 rounded-lg p-5 border border-slate-700 shadow-md">
                <h2 className="text-amber-500 font-bold mb-4 uppercase tracking-wider text-sm border-b border-slate-700 pb-2">Aspect Influence</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ledger.aspectInfluence.map((aspect) => (
                        <div key={aspect.aspectId} className="bg-slate-900/50 p-4 rounded border border-slate-700 flex flex-col justify-between">
                            <div>
                                <div className="font-bold text-slate-200 mb-1">{aspect.aspectId}</div>
                                <div className="text-xs text-slate-400 mb-3 block h-10">
                                    {aspect.effects.join(', ')}
                                </div>
                            </div>
                            <div className="flex items-end justify-between">
                                <span className="text-xs text-slate-500">Influence</span>
                                <span className={`text-xl font-mono font-bold ${aspect.influence > 0 ? 'text-emerald-400' : aspect.influence < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                    {aspect.influence > 0 ? '+' : ''}{aspect.influence}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default RealmLedgerTab;
