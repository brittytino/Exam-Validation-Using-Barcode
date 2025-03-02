import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '../utils/auth';
import ScannerComponent from '../components/ScannerComponent';
import SyncStatus from '../components/SyncStatus';
import ScanHistory from '../components/ScanHistory';
import { BarChart4, LogOut, QrCode, Settings, Info, FileBarChart2, BookOpen } from 'lucide-react';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'scan' | 'history' | 'settings' | 'about' | 'marks'>('scan');
  const [username, setUsername] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [syncInterval, setSyncInterval] = useState<string>('60');

  useEffect(() => {
    const checkAuth = async () => {
      const { isAuthenticated, user } = await getCurrentUser();
      
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }
      
      if (user) {
        setUsername(user.username);
        setRole(user.role);
      }
    };
    
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSyncIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSyncInterval(e.target.value);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <QrCode size={24} className="text-blue-600" />
              <h1 className="ml-2 text-xl font-bold text-gray-900">Exam Scanner</h1>
            </div>
            <div className="flex items-center">
              <div className="mr-4 text-right">
                <div className="text-sm font-medium text-gray-900">{username}</div>
                <div className="text-xs text-gray-500 capitalize">{role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main content area */}
          <div className="md:col-span-2 space-y-6">
            {activeTab === 'scan' && <ScannerComponent />}
            {activeTab === 'history' && <ScanHistory />}
            {activeTab === 'marks' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold mb-4">Exam Marks</h2>
                <p className="text-gray-600 mb-4">
                  View and manage marks for validated exams. Scan a barcode first to enter marks for a student.
                </p>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-md font-medium mb-2">Mark Distribution</h3>
                  <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                    <li>10 mark questions: 1 question × 10 marks = 10 marks</li>
                    <li>4 mark questions: 4 questions × 4 marks = 16 marks</li>
                    <li>3 mark questions: 8 questions × 3 marks = 24 marks</li>
                    <li>Total per subject: 50 marks</li>
                    <li>Grand total (5 subjects): 250 marks</li>
                  </ul>
                </div>
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setActiveTab('scan')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md"
                  >
                    Scan Barcode to Enter Marks
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold mb-4">Settings</h2>
                <div className="space-y-4">
                  <div className="border-b pb-4">
                    <h3 className="text-md font-medium mb-2">Camera Settings</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Configure camera preferences for barcode scanning.
                    </p>
                    <div className="flex items-center">
                      <input
                        id="auto-flash"
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="auto-flash" className="ml-2 block text-sm text-gray-700">
                        Enable flash when available
                      </label>
                    </div>
                  </div>
                  
                  <div className="border-b pb-4">
                    <h3 className="text-md font-medium mb-2">Sync Settings</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Configure how and when data syncs with the server.
                    </p>
                    <div className="mt-2">
                      <label htmlFor="sync-interval" className="block text-sm text-gray-700 mb-1">
                        Auto-sync interval
                      </label>
                      <select
                        id="sync-interval"
                        value={syncInterval}
                        onChange={handleSyncIntervalChange}
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      >
                        <option value="15">Every 15 minutes</option>
                        <option value="30">Every 30 minutes</option>
                        <option value="60">Every hour</option>
                        <option value="manual">Manual sync only</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-md font-medium mb-2">Data Management</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Manage local data storage and caching.
                    </p>
                    <button
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm"
                    >
                      Clear Scan History
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'about' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold mb-4">About Exam Barcode Scanner</h2>
                <div className="prose prose-sm text-gray-600">
                  <p>
                    The Exam Barcode Scanner is an offline-first application designed for educational institutions to validate exam papers using barcodes and record student marks.
                  </p>
                  
                  <h3 className="text-md font-medium mt-4 mb-2">Key Features</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Offline-first architecture - works without internet connection</li>
                    <li>Real-time barcode scanning and validation</li>
                    <li>Mark entry system for 5 subjects with standardized marking scheme</li>
                    <li>Secure authentication system</li>
                    <li>Background synchronization when online</li>
                    <li>Comprehensive scan history and reporting</li>
                  </ul>
                  
                  <h3 className="text-md font-medium mt-4 mb-2">How to Use</h3>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Log in with your credentials</li>
                    <li>Navigate to the Scan tab</li>
                    <li>Position the exam barcode within the scanner frame</li>
                    <li>For valid barcodes, enter marks for each subject</li>
                    <li>View validation results and scan history</li>
                    <li>Sync data when internet connection is available</li>
                  </ol>
                  
                  <h3 className="text-md font-medium mt-4 mb-2">Mark Distribution</h3>
                  <p>Each subject follows this mark distribution:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>10 mark questions: 1 question × 10 marks = 10 marks</li>
                    <li>4 mark questions: 4 questions × 4 marks = 16 marks</li>
                    <li>3 mark questions: 8 questions × 3 marks = 24 marks</li>
                    <li>Total per subject: 50 marks</li>
                  </ul>
                  
                  <h3 className="text-md font-medium mt-4 mb-2">Test Barcodes</h3>
                  <p>For testing purposes, you can manually enter these codes:</p>
                  <ul className="list-disc pl-5 space-y-1 font-mono text-xs">
                    <li>MATH2023001 - Valid Mathematics exam</li>
                    <li>PHYS2023002 - Invalid Physics exam</li>
                    <li>BIO2023001 - Expired Biology exam</li>
                  </ul>
                  
                  <p className="mt-4 text-xs text-gray-500">
                    Version 0.1.0 | © 2025 Exam Scanner
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Sync status widget */}
            <SyncStatus />

            {/* Navigation */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <nav className="divide-y divide-gray-200">
                <button
                  onClick={() => setActiveTab('scan')}
                  className={`w-full flex items-center px-4 py-3 text-sm ${
                    activeTab === 'scan'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <QrCode size={20} className="mr-3" />
                  Scan Barcode
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`w-full flex items-center px-4 py-3 text-sm ${
                    activeTab === 'history'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <BarChart4 size={20} className="mr-3" />
                  Scan History
                </button>
                <button
                  onClick={() => setActiveTab('marks')}
                  className={`w-full flex items-center px-4 py-3 text-sm ${
                    activeTab === 'marks'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <BookOpen size={20} className="mr-3" />
                  Exam Marks
                </button>
                <button
                  onClick={() => navigate('/generate')}
                  className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <FileBarChart2 size={20} className="mr-3" />
                  Generate Barcode
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center px-4 py-3 text-sm ${
                    activeTab === 'settings'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Settings size={20} className="mr-3" />
                  Settings
                </button>
                <button
                  onClick={() => setActiveTab('about')}
                  className={`w-full flex items-center px-4 py-3 text-sm ${
                    activeTab === 'about'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Info size={20} className="mr-3" />
                  About
                </button>
              </nav>
            </div>

            {/* Offline status */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Offline Mode</h3>
              <p className="text-xs text-gray-600">
                This application works offline. All scans and marks are stored locally and will sync when you're back online.
              </p>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="text-xs font-medium text-gray-700 mb-1">Quick Tips</h4>
                <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                  <li>Ensure good lighting for better scanning</li>
                  <li>Hold the device steady while scanning</li>
                  <li>Manual entry is available if scanning fails</li>
                  <li>Enter marks for all 5 subjects after validation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;