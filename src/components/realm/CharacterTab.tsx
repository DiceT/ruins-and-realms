import React from 'react';
import { useRealmStore } from '../../stores/realm';

const CharacterTab: React.FC = () => {
    const character = useRealmStore(state => state.character);
    const updateCharacter = useRealmStore(state => state.updateCharacter);

    // Helper handling
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateCharacter({ name: e.target.value });
    };

    const getHealthPercent = () => {
        return Math.min(100, Math.max(0, (character.healthPoints.current / character.healthPoints.max) * 100));
    };

    const getXpPercent = () => {
        return Math.min(100, Math.max(0, (character.xp / character.xpToNextLevel) * 100));
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-6">

            {/* Top Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Identity & Stats Block */}
                <div className="bg-slate-800 rounded-lg p-5 border border-slate-700 shadow-md">
                    <h2 className="text-amber-500 font-bold mb-4 uppercase tracking-wider text-sm border-b border-slate-700 pb-2">Identity</h2>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Name</label>
                            <input
                                type="text"
                                value={character.name}
                                onChange={handleNameChange}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 focus:border-amber-500 focus:outline-none"
                                placeholder="Character Name"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Level</label>
                            <div className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200">
                                {character.level}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Health Bar */}
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">HEALTH POINTS</span>
                                <span className="text-red-400">{character.healthPoints.current} / {character.healthPoints.max}</span>
                            </div>
                            <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                                <div
                                    className="h-full bg-red-600/80 transition-all duration-300 ease-out"
                                    style={{ width: `${getHealthPercent()}%` }}
                                />
                            </div>
                        </div>

                        {/* XP Bar */}
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">XP</span>
                                <span className="text-yellow-400">{character.xp} / {character.xpToNextLevel}</span>
                            </div>
                            <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                                <div
                                    className="h-full bg-yellow-500/80 transition-all duration-300 ease-out"
                                    style={{ width: `${getXpPercent()}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Core Stats */}
                    <div className="grid grid-cols-3 gap-2 mt-6">
                        <StatBox label="SHIFT" value={character.shift} />
                        <StatBox label="DISCIPLINE" value={character.discipline} />
                        <StatBox label="PRECISION" value={character.precision} />
                    </div>
                </div>

                {/* Equipment Block (Placeholder for now) */}
                <div className="bg-slate-800 rounded-lg p-5 border border-slate-700 shadow-md">
                    <h2 className="text-amber-500 font-bold mb-4 uppercase tracking-wider text-sm border-b border-slate-700 pb-2">Equipment</h2>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center bg-slate-700/30 p-2 rounded">
                            <span className="text-slate-400 text-sm">WEAPON</span>
                            <span className="text-slate-200">{character.weapon || 'Unarmed'}</span>
                        </div>

                        <div className="bg-slate-900/50 p-3 rounded">
                            <div className="text-xs text-slate-500 mb-2 uppercase">Manoeuvres</div>
                            {character.manoeuvres.length === 0 ? (
                                <div className="text-slate-600 text-sm italic">None equipped</div>
                            ) : (
                                <ul className="space-y-1">
                                    {character.manoeuvres.map((m, idx) => (
                                        <li key={idx} className="text-sm text-slate-300 flex justify-between">
                                            <span>{m.name}</span>
                                            <span className="text-slate-500">[{m.dice.join(',')}]</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Inventory Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800 rounded-lg p-5 border border-slate-700 shadow-md">
                    <h2 className="text-amber-500 font-bold mb-4 uppercase tracking-wider text-sm border-b border-slate-700 pb-2">Inventory (Gold: {character.coins.gold})</h2>
                    {/* Simple list for now */}
                    <div className="text-sm text-slate-400">
                        <p>Large Items: {character.largeItems.length}/10</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            {character.largeItems.map((item, i) => (
                                <li key={i}>{item.name} x{item.quantity}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

        </div>
    );
};

const StatBox = ({ label, value }: { label: string, value: number }) => (
    <div className="bg-slate-700/50 p-2 rounded text-center border border-slate-600">
        <div className="text-[10px] text-slate-400 font-bold mb-1">{label}</div>
        <div className="text-xl font-mono text-white">{value >= 0 ? `+${value}` : value}</div>
    </div>
);

export default CharacterTab;
