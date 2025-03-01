import React, { useState, useEffect } from 'react';
import { db, ScanLog } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle, XCircle, Clock, AlertTriangle, CloudOff, CloudCog as CloudCheck } from 'lucide-react';

const ScanHistory: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  
  // Use Dexie hooks to get live updates from the database
  const scanLogs = useLiveQuery(
    async () => {
      let query = db.scanLogs.orderBy('scannedAt').reverse();
      
      if (filter === 'valid') {
        query = query.filter(log => log.status === 'valid');
      } else if (filter === 'invalid') {
        query = query.filter(log => log.status !== 'valid');
      }
      
      return await query.limit(50).toArray();
    },
    [filter]
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'invalid':
        return <XCircle size={18} className="text-red-500" />;
      case 'expired':
        return <Clock size={18} className="text-orange-500" />;
      default:
        return <AlertTriangle size={18} className="text-yellow-500" />;
    }
  };

  const getSyncIcon = (syncStatus: string) => {
    switch (syncStatus) {
      case 'synced':
        return <CloudCheck size={18} className="text-green-500" />;
      case 'pending':
        return <CloudOff size={18} className="text-gray-400" />;
      default:
        return <AlertTriangle size={18} className="text-red-500" />;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Scans</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded-md ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('valid')}
            className={`px-3 py-1 text-sm rounded-md ${
              filter === 'valid'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Valid
          </button>
          <button
            onClick={() => setFilter('invalid')}
            className={`px-3 py-1 text-sm rounded-md ${
              filter === 'invalid'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Invalid
          </button>
        </div>
      </div>
      
      <div className="overflow-hidden">
        {!scanLogs || scanLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No scan history available
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Barcode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sync
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scanLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(log.status)}
                        <span className="ml-2 text-sm text-gray-900 capitalize">
                          {log.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">
                        {log.barcodeId !== 'unknown' ? log.barcodeId.substring(0, 8) + '...' : 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Student: {log.studentId !== 'unknown' ? log.studentId : 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(log.scannedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {getSyncIcon(log.syncStatus)}
                        <span className="ml-2 text-xs text-gray-500 capitalize">
                          {log.syncStatus}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanHistory;