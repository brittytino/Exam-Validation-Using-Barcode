import React, { useState, useEffect, useRef } from 'react';
import { BarcodeScanner, processScan } from '../utils/scanner';
import { getCurrentUser } from '../utils/auth';
import { db, saveExamMarks, getExamMarks } from '../db/schema';
import { Camera, RefreshCw, Check, X, AlertTriangle, Keyboard } from 'lucide-react';

const ScannerComponent: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'valid' | 'invalid' | 'expired' | 'unknown' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [examName, setExamName] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<boolean>(false);
  const [showMarkEntry, setShowMarkEntry] = useState<boolean>(false);
  const [marks, setMarks] = useState({
    tenMarks: 0,
    fourMarks: [0, 0, 0, 0],
    eightMarks: [0, 0, 0]
  });
  const [totalMarks, setTotalMarks] = useState(0);
  const [savingMarks, setSavingMarks] = useState(false);
  const [marksSaved, setMarksSaved] = useState(false);
  const [examId, setExamId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<BarcodeScanner | null>(null);

  // Get current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { isAuthenticated, user } = await getCurrentUser();
      if (isAuthenticated && user) {
        setUserId(user.id);
      }
    };
    
    fetchUser();
  }, []);

  // Calculate total marks whenever marks change
  useEffect(() => {
    const tenMarksTotal = marks.tenMarks;
    const fourMarksTotal = marks.fourMarks.reduce((sum, mark) => sum + mark, 0);
    const eightMarksTotal = marks.eightMarks.reduce((sum, mark) => sum + mark, 0);
    
    setTotalMarks(tenMarksTotal + fourMarksTotal + eightMarksTotal);
  }, [marks]);

  const startScanner = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Camera elements not initialized');
      setCameraError(true);
      return;
    }
    
    setError(null);
    setScanResult(null);
    setScanMessage(null);
    setScanStatus(null);
    setExamName(null);
    setStudentId(null);
    setSubject(null);
    setExamId(null);
    setShowMarkEntry(false);
    setMarksSaved(false);
    
    try {
      // Create scanner instance
      scannerRef.current = new BarcodeScanner({
        onDetected: handleScanResult,
        onError: handleScanError,
        onStart: () => setScanning(true),
        onStop: () => setScanning(false)
      });
      
      // Start scanning
      await scannerRef.current.start(videoRef.current, canvasRef.current);
    } catch (error) {
      console.error('Failed to start scanner:', error);
      setError('Failed to access camera. Please check permissions and try again.');
      setCameraError(true);
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
    }
    setScanning(false);
  };

  const handleScanResult = async (result: string) => {
    setScanResult(result);
    
    if (!userId) {
      setScanMessage('User not authenticated');
      setScanStatus('invalid');
      return;
    }
    
    try {
      // Process the scan
      const processResult = await processScan(result, userId);
      
      setScanMessage(processResult.message);
      setScanStatus(processResult.scanLog?.status || 'unknown');
      
      if (processResult.examName) {
        setExamName(processResult.examName);
        
        // Extract subject from exam name
        const subjectMatch = processResult.examName.match(/^(.*?)\s+Exam/);
        if (subjectMatch && subjectMatch[1]) {
          setSubject(subjectMatch[1]);
        }
      }
      
      if (processResult.studentId) {
        setStudentId(processResult.studentId);
      }
      
      if (processResult.scanLog?.examId) {
        setExamId(processResult.scanLog.examId);
      }
      
      // Show mark entry form if scan is valid
      if (processResult.scanLog?.status === 'valid') {
        setShowMarkEntry(true);
        
        // Check if marks already exist for this exam and student
        if (examId && studentId) {
          const existingMarks = await getExamMarks(examId, studentId);
          if (existingMarks) {
            try {
              const parsedMarks = JSON.parse(existingMarks.marks);
              setMarks(parsedMarks);
              setTotalMarks(existingMarks.totalMarks);
            } catch (e) {
              console.error('Error parsing existing marks:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing scan:', error);
      setScanMessage('Failed to process scan');
      setScanStatus('invalid');
    }
  };

  const handleScanError = (error: Error) => {
    console.error('Scan error:', error);
    setError(error.message);
    setScanning(false);
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const code = formData.get('manualCode') as string;
    
    if (!code) {
      setError('Please enter a barcode');
      return;
    }
    
    handleScanResult(code);
  };

  const handleMarkChange = (type: 'tenMarks' | 'fourMarks' | 'eightMarks', index?: number, value?: number) => {
    setMarks(prevMarks => {
      const newMarks = { ...prevMarks };
      
      if (type === 'tenMarks') {
        newMarks.tenMarks = Math.min(10, Math.max(0, value || 0));
      } else if (type === 'fourMarks' && index !== undefined && value !== undefined) {
        newMarks.fourMarks[index] = Math.min(4, Math.max(0, value));
      } else if (type === 'eightMarks' && index !== undefined && value !== undefined) {
        newMarks.eightMarks[index] = Math.min(8, Math.max(0, value));
      }
      
      return newMarks;
    });
  };

  const handleSaveMarks = async () => {
    if (!userId || !scanResult || !subject || !studentId || !examId) {
      setError('Missing required information');
      return;
    }
    
    setSavingMarks(true);
    setError(null);
    
    try {
      // Save marks to database
      await saveExamMarks(
        examId,
        studentId,
        marks,
        totalMarks,
        userId,
        `Marks for ${subject} exam`
      );
      
      setMarksSaved(true);
      setSavingMarks(false);
    } catch (error) {
      console.error('Error saving marks:', error);
      setError('Failed to save marks. Please try again.');
      setSavingMarks(false);
    }
  };

  const resetScanner = () => {
    stopScanner();
    setScanResult(null);
    setScanMessage(null);
    setScanStatus(null);
    setExamName(null);
    setStudentId(null);
    setSubject(null);
    setExamId(null);
    setShowMarkEntry(false);
    setMarksSaved(false);
    setError(null);
    setCameraError(false);
    setMarks({
      tenMarks: 0,
      fourMarks: [0, 0, 0, 0],
      eightMarks: [0, 0, 0]
    });
  };

  const renderStatusIcon = () => {
    switch (scanStatus) {
      case 'valid':
        return <Check size={24} className="text-green-500" />;
      case 'invalid':
        return <X size={24} className="text-red-500" />;
      case 'expired':
        return <AlertTriangle size={24} className="text-orange-500" />;
      default:
        return null;
    }
  };

  const renderMarkEntryForm = () => {
    if (!subject) return null;
    
    return (
      <div className="mt-6 border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">
          Enter Marks for {subject}
        </h3>
        
        <div className="bg-blue-50 p-3 rounded-md mb-4 text-sm">
          <p className="font-medium">Mark Distribution:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>10 mark questions: 1 question × 10 marks = 10 marks</li>
            <li>4 mark questions: 4 questions × 4 marks = 16 marks</li>
            <li>8 mark questions: 3 questions × 8 marks = 24 marks</li>
            <li>Total: 50 marks</li>
          </ul>
        </div>
        
        <div className="space-y-4">
          {/* 10 Mark Question */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              10 Mark Question (max 10)
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={marks.tenMarks}
              onChange={(e) => handleMarkChange('tenMarks', undefined, parseInt(e.target.value) || 0)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* 4 Mark Questions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              4 Mark Questions (max 4 each)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {marks.fourMarks.map((mark, index) => (
                <input
                  key={`four-${index}`}
                  type="number"
                  min="0"
                  max="4"
                  value={mark}
                  onChange={(e) => handleMarkChange('fourMarks', index, parseInt(e.target.value) || 0)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Q${index + 1}`}
                />
              ))}
            </div>
          </div>
          
          {/* 8 Mark Questions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              8 Mark Questions (max 8 each)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {marks.eightMarks.map((mark, index) => (
                <input
                  key={`eight-${index}`}
                  type="number"
                  min="0"
                  max="8"
                  value={mark}
                  onChange={(e) => handleMarkChange('eightMarks', index, parseInt(e.target.value) || 0)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Q${index + 1}`}
                />
              ))}
            </div>
          </div>
          
          {/* Total Marks */}
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Marks:</span>
              <span className="text-xl font-bold">{totalMarks} / 50</span>
            </div>
          </div>
          
          {/* Save Button */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={resetScanner}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveMarks}
              disabled={savingMarks || marksSaved}
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                marksSaved
                  ? 'bg-green-600'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              } ${savingMarks ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {savingMarks ? (
                <>
                  <RefreshCw size={16} className="inline mr-2 animate-spin" />
                  Saving...
                </>
              ) : marksSaved ? (
                <>
                  <Check size={16} className="inline mr-2" />
                  Saved
                </>
              ) : (
                'Save Marks'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold mb-4">Barcode Scanner</h2>
        
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        {scanResult ? (
          <div>
            <div className={`p-4 rounded-md mb-4 flex items-start ${
              scanStatus === 'valid'
                ? 'bg-green-100'
                : scanStatus === 'expired'
                ? 'bg-orange-100'
                : 'bg-red-100'
            }`}>
              <div className="mr-3 mt-0.5">
                {renderStatusIcon()}
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">
                  {scanStatus === 'valid'
                    ? 'Valid Barcode'
                    : scanStatus === 'expired'
                    ? 'Expired Barcode'
                    : 'Invalid Barcode'}
                </h3>
                <p className="text-sm text-gray-700">{scanMessage}</p>
                
                {examName && (
                  <p className="text-sm font-medium mt-2">
                    Exam: <span className="font-bold">{examName}</span>
                  </p>
                )}
                
                {studentId && (
                  <p className="text-sm font-medium">
                    Student ID: <span className="font-bold">{studentId}</span>
                  </p>
                )}
                
                <p className="text-sm font-medium">
                  Barcode: <span className="font-mono">{scanResult}</span>
                </p>
              </div>
            </div>
            
            {showMarkEntry && !marksSaved ? (
              renderMarkEntryForm()
            ) : marksSaved ? (
              <div className="mt-6 text-center">
                <div className="bg-green-100 text-green-700 p-4 rounded-md mb-4">
                  <Check size={24} className="inline-block mb-1" />
                  <p className="font-medium">Marks saved successfully!</p>
                </div>
                <button
                  onClick={resetScanner}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Scan Another Barcode
                </button>
              </div>
            ) : (
              <div className="mt-6 text-center">
                <button
                  onClick={resetScanner}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Scan Another Barcode
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {scanning ? (
              <>
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                  ></video>
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  ></canvas>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-white rounded-lg"></div>
                  </div>
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-red-500 animate-scan"
                    style={{ opacity: 0.8 }}
                  ></div>
                </div>
                
                <div className="flex justify-center">
                  <button
                    onClick={stopScanner}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Cancel
                  </button>
                </div>
                
                <div className="mt-4 text-center text-sm text-gray-500">
                  <p>Position the barcode within the frame</p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-gray-100 rounded-lg p-8 mb-4 flex flex-col items-center justify-center">
                  <Camera size={48} className="text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-4 text-center">
                    {cameraError
                      ? 'Camera access failed. Please check permissions or try manual entry.'
                      : 'Click the button below to start scanning a barcode'}
                  </p>
                  <button
                    onClick={startScanner}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Start Scanner
                  </button>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or enter code manually</span>
                  </div>
                </div>
                
                <form onSubmit={handleManualEntry} className="mt-4">
                  <div className="flex">
                    <input
                      type="text"
                      name="manualCode"
                      placeholder="Enter barcode"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-2 rounded-r-md"
                    >
                      Submit
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScannerComponent;