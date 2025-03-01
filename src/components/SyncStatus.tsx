import React, { useState, useEffect } from 'react';
import { isOnline, syncData, pullUpdates, registerNetworkListeners } from '../utils/sync';
import { db } from '../db/schema';
import { RefreshCw, Wifi, WifiOff, Check, AlertCircle } from 'lucide-react';

const SyncStatus: React.FC = () => {
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pendingItems, setPendingItems] = useState(0);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check initial online status
    setOnline(isOnline());
    
    // Load last sync time from localStorage
    const lastSyncStr = localStorage.getItem('lastSync');
    if (lastSyncStr) {
      setLastSync(new Date(lastSyncStr));
    }
    
    // Register network listeners
    const handleOnline = () => {
      setOnline(true);
      // Auto-sync when coming back online
      handleSync();
    };
    
    const handleOffline = () => {
      setOnline(false);
    };
    
    registerNetworkListeners(handleOnline, handleOffline);
    
    // Count pending items on mount and set up interval to recheck
    countPendingItems();
    const intervalId = setInterval(countPendingItems, 30000);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const countPendingItems = async () => {
    try {
      const count = await db.syncQueue.count();
      setPendingItems(count);
    } catch (error) {
      console.error('Error counting pending items:', error);
    }
  };

  const handleSync = async () => {
    if (syncing || !online) return;
    
    setSyncing(true);
    setSyncMessage(null);
    
    try {
      // Push local changes
      const pushResult = await syncData();
      
      // Pull remote updates
      const pullResult = await pullUpdates();
      
      // Update last sync time
      const now = new Date();
      setLastSync(now);
      localStorage.setItem('lastSync', now.toISOString());
      
      // Update pending items count
      await countPendingItems();
      
      // Set success message
      setSyncMessage(
        pushResult.success && pullResult.success
          ? `Sync completed. ${pushResult.syncedItems || 0} items synced.`
          : 'Sync partially completed with some errors.'
      );
    } catch (error) {
      console.error('Sync error:', error);
      setSyncMessage('Sync failed. Please try again later.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Sync Status</h3>
        <div className="flex items-center">
          {online ? (
            <Wifi size={18} className="text-green-500 mr-2" />
          ) : (
            <WifiOff size={18} className="text-red-500 mr-2" />
          )}
          <span className={online ? 'text-green-500' : 'text-red-500'}>
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Pending Items</span>
          <span className="font-medium">{pendingItems}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Last Synced</span>
          <span className="font-medium">
            {lastSync ? new Intl.DateTimeFormat('en-US', {
              dateStyle: 'short',
              timeStyle: 'short'
            }).format(lastSync) : 'Never'}
          </span>
        </div>
      </div>
      
      {syncMessage && (
        <div className={`text-sm p-2 rounded mb-4 ${
          syncMessage.includes('failed') 
            ? 'bg-red-100 text-red-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          <div className="flex items-center">
            {syncMessage.includes('failed') ? (
              <AlertCircle size={16} className="mr-2" />
            ) : (
              <Check size={16} className="mr-2" />
            )}
            {syncMessage}
          </div>
        </div>
      )}
      
      <button
        onClick={handleSync}
        disabled={syncing || !online}
        className={`w-full py-2 px-4 rounded-md flex items-center justify-center ${
          online
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {syncing ? (
          <>
            <RefreshCw size={18} className="mr-2 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <RefreshCw size={18} className="mr-2" />
            Sync Now
          </>
        )}
      </button>
    </div>
  );
};

export default SyncStatus;