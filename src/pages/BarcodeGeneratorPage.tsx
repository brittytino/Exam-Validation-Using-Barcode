import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../utils/auth';
import BarcodeGenerator from '../components/BarcodeGenerator';
import { QrCode, ArrowLeft } from 'lucide-react';

const BarcodeGeneratorPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { isAuthenticated } = await getCurrentUser();
      
      if (!isAuthenticated) {
        navigate('/login');
      }
    };
    
    checkAuth();
  }, [navigate]);

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
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft size={20} className="mr-1" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main content area */}
          <div className="md:col-span-2">
            <BarcodeGenerator />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Instructions */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold mb-3">How to Use</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
                <li>Enter the subject name (first 3 characters will be used as the barcode prefix)</li>
                <li>Enter the student ID</li>
                <li>Click "Generate Barcode" to create a new barcode</li>
                <li>Download the barcode image or save it to your device</li>
                <li>Use the scanner in the Dashboard to scan this barcode</li>
              </ol>
            </div>

            {/* Tips */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Tips</h3>
              <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                <li>Generated barcodes are automatically saved to the local database</li>
                <li>Barcodes are valid for 30 days from generation</li>
                <li>You can print the barcode and attach it to physical exam papers</li>
                <li>For testing, you can scan the barcode directly from your screen</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BarcodeGeneratorPage;