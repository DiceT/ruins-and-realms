import React, { useState } from 'react';
import { useRealmStore } from '../../stores/realm';
import CharacterTab from './CharacterTab';
import UnclaimedLandTab from './UnclaimedLandTab';
import ClaimedLandTab from './ClaimedLandTab';
import BuildingsTab from './BuildingsTab';
import HousingTab from './HousingTab';
import RealmLedgerTab from './RealmLedgerTab';
import { exportSaveFile } from '../../stores/realm/utils/saveLoad';

interface RealmManagementScreenProps {
    onClose?: () => void;
}

const RealmManagementScreen: React.FC<RealmManagementScreenProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<'character' | 'ledger' | 'buildings' | 'housing' | 'unclaimed' | 'claimed'>('character');

    // Example of using the store
    const realmName = useRealmStore(state => state.world.name);
    const currentYear = useRealmStore(state => state.world.currentYear);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'character':
                return <CharacterTab />;
            case 'ledger':
                return <RealmLedgerTab />;
            case 'buildings':
                return <BuildingsTab />;
            case 'housing':
                return <HousingTab />;
            case 'unclaimed':
                return <div className="p-4">Unclaimed Land Coming Soon</div>;
            case 'claimed':
                return <div className="p-4">Claimed Land Coming Soon</div>;
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shadow-md">
                <div>
                    <h1 className="text-2xl font-bold text-amber-500 tracking-wider">REALM MANAGEMENT</h1>
                    <div className="text-sm text-slate-400">
                        {realmName} • Year {currentYear} • {useRealmStore.getState().world.currentSeason}
                    </div>
                </div>

                <div className="flex space-x-2">
                    {/* Debug/Actions will go here */}
                    <button
                        onClick={() => exportSaveFile(useRealmStore.getState())}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 text-xs text-slate-300 transition-colors"
                    >
                        Save Realm
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 rounded border border-red-800/50 text-xs text-red-200 transition-colors"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex px-6 bg-slate-800 border-b border-slate-700">
                <TabButton
                    id="character"
                    label="CHARACTER"
                    active={activeTab === 'character'}
                    onClick={setActiveTab}
                />
                <TabButton
                    id="ledger"
                    label="REALM LEDGER"
                    active={activeTab === 'ledger'}
                    onClick={setActiveTab}
                />
                <TabButton
                    id="buildings"
                    label="BUILDINGS"
                    active={activeTab === 'buildings'}
                    onClick={setActiveTab}
                />
                <TabButton
                    id="housing"
                    label="HOUSING"
                    active={activeTab === 'housing'}
                    onClick={setActiveTab}
                />
                <TabButton
                    id="unclaimed"
                    label="UNCLAIMED LAND"
                    active={activeTab === 'unclaimed'}
                    onClick={setActiveTab}
                />
                <TabButton
                    id="claimed"
                    label="CLAIMED LAND"
                    active={activeTab === 'claimed'}
                    onClick={setActiveTab}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto bg-slate-900 custom-scrollbar">
                {renderTabContent()}
            </div>
        </div>
    );
};

interface TabButtonProps {
    id: any;
    label: string;
    active: boolean;
    onClick: (id: any) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ id, label, active, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`
      px-4 py-3 text-sm font-semibold tracking-wide border-b-2 transition-colors
      ${active
                ? 'border-amber-500 text-amber-500 bg-slate-800/50'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'}
    `}
    >
        {label}
    </button>
);

export default RealmManagementScreen;
