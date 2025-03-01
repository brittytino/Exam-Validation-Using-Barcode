import { db, SyncQueue } from '../db/schema';

// API configuration
const API_URL = 'https://api.example.com'; // Replace with your actual API URL
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 60000; // 1 minute

// Check if the device is online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Register event listeners for online/offline status
export function registerNetworkListeners(
  onOnline: () => void,
  onOffline: () => void
): void {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
}

// Unregister event listeners
export function unregisterNetworkListeners(
  onOnline: () => void,
  onOffline: () => void
): void {
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
}

// Sync data with the server
export async function syncData(): Promise<{
  success: boolean;
  message: string;
  syncedItems?: number;
}> {
  if (!isOnline()) {
    return { success: false, message: 'Device is offline' };
  }

  try {
    // Get items from sync queue
    const queueItems = await db.syncQueue
      .where('attempts')
      .below(MAX_RETRY_ATTEMPTS)
      .toArray();

    if (queueItems.length === 0) {
      return { success: true, message: 'No items to sync', syncedItems: 0 };
    }

    // In a real app, we would actually sync with a server
    // For demo purposes, we'll simulate a successful sync
    console.log(`Simulating sync of ${queueItems.length} items`);
    
    // Mark all items as synced
    for (const item of queueItems) {
      // Remove from queue
      await db.syncQueue.delete(item.id);
      
      // If it's a scan log, update its sync status
      if (item.table === 'scanLogs') {
        const data = JSON.parse(item.data);
        await db.scanLogs.update(item.recordId, {
          syncStatus: 'synced',
          syncedAt: new Date()
        });
      }
    }

    return {
      success: true,
      message: `Synced ${queueItems.length} items`,
      syncedItems: queueItems.length
    };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, message: 'An error occurred during sync' };
  }
}

// Sync a single item with the server (mock implementation)
async function syncItem(item: SyncQueue): Promise<{ success: boolean }> {
  // In a real app, this would make actual API calls
  // For demo purposes, we'll simulate a successful sync
  console.log(`Simulating sync of item: ${item.table}/${item.recordId}`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // 90% success rate for demo
  const success = Math.random() < 0.9;
  
  if (success) {
    // If it's a scan log, update its sync status
    if (item.table === 'scanLogs') {
      await db.scanLogs.update(item.recordId, {
        syncStatus: 'synced',
        syncedAt: new Date()
      });
    }
  }
  
  return { success };
}

// Pull updates from the server (mock implementation)
export async function pullUpdates(): Promise<{
  success: boolean;
  message: string;
}> {
  if (!isOnline()) {
    return { success: false, message: 'Device is offline' };
  }

  try {
    // In a real app, this would make actual API calls
    // For demo purposes, we'll simulate a successful pull
    console.log('Simulating pull of remote updates');
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update last sync timestamp
    localStorage.setItem('lastPullSync', new Date().toISOString());
    
    return { success: true, message: 'Updates pulled successfully' };
  } catch (error) {
    console.error('Pull updates error:', error);
    return { success: false, message: 'An error occurred while pulling updates' };
  }
}

// Pull updates for a specific table (mock implementation)
async function pullTableUpdates(
  table: 'exams' | 'barcodes' | 'users',
  since: Date
): Promise<void> {
  // In a real app, this would make actual API calls
  // For demo purposes, we'll just log the action
  console.log(`Simulating pull of ${table} updates since ${since.toISOString()}`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // No actual updates in demo mode
}

// Schedule periodic sync
export function scheduleSync(intervalMinutes: number = 60): number {
  return window.setInterval(() => {
    if (isOnline()) {
      syncData().catch(console.error);
      pullUpdates().catch(console.error);
    }
  }, intervalMinutes * 60 * 1000);
}

// Cancel scheduled sync
export function cancelScheduledSync(intervalId: number): void {
  window.clearInterval(intervalId);
}