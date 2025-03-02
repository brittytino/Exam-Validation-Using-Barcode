import React, { useState, useEffect, useRef } from 'react';
import { Camera, AlertTriangle, Check, X, RefreshCw } from 'lucide-react';
import { db, validateBarcode } from '../db/schema';
import { BarcodeScanner, processScan } from '../utils/scanner';
import { getCurrentUser } from '../utils/auth';

interface ScanResult {
  isValid: boolean;
  message: string;
  code: string;
  studentId?: string;
  examId?: string;
  examName?: string;
}

const ScannerComponent: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showMarkEntry, setShowMarkEntry] = useState(false);
  const [marks, setMarks] = useState({
    java: { q1: '', q2: '', q3: '', total: '0' },
    cpp: { q1: '', q2: '', q3: '', total: '0' },
    python: { q1: '', q2: '', q3: '', total: '0' },
    javascript: { q1: '', q2: '', q3: '', total: '0' },
    os: { q1: '', q2: '', q3: '', total: '0' }
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<BarcodeScanner | null>(null);

  useEffect(() => {
    // Get current user
    const fetchUser = async () => {
      const { isAuthenticated, user } = await getCurrentUser();
      if (isAuthenticated && user) {
        setUserId(user.id);
      }
    };
    
    fetchUser();
    
    // Get available cameras
    const getCameras = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
          setError('Media devices API not supported in this browser');
          return;
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        setCameras(videoDevices);
        
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error getting cameras:', err);
        setError('Failed to access camera list');
      }
    };
    
    getCameras();
    
    // Clean up on unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop();
      }
    };
  }, []);

  const startScanning = async () => {
    setError(null);
    setScanResult(null);
    
    if (!videoRef.current || !canvasRef.current) {
      setError('Camera elements not initialized. Please refresh the page and try again.');
      return;
    }
    
    try {
      // Create scanner instance if it doesn't exist
      if (!scannerRef.current) {
        scannerRef.current = new BarcodeScanner({
          onDetected: handleCodeDetected,
          onError: (err) => {
            console.error('Scanner error:', err);
            setError(err.message);
            setScanning(false);
          },
          onStart: () => {
            setScanning(true);
          },
          onStop: () => {
            setScanning(false);
          }
        });
      }
      
      // Start scanning with selected camera
      await scannerRef.current.start(
        videoRef.current,
        canvasRef.current,
        selectedCamera
      );
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Failed to start camera. Please check camera permissions and try again.');
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
    }
    setScanning(false);
  };

  const handleCodeDetected = async (code: string) => {
    if (!userId) {
      setError('User not authenticated. Please log in again.');
      return;
    }
    
    try {
      // Process the scanned barcode
      const result = await processScan(code, userId);
      
      if (result.success) {
        // Get barcode details
        const validationResult = await validateBarcode(code);
        const barcode = validationResult.barcode;
        
        setScanResult({
          isValid: validationResult.isValid,
          message: validationResult.message,
          code: code,
          studentId: barcode?.studentId,
          examId: barcode?.examId,
          examName: result.examName
        });
        
        // If valid, show mark entry form
        if (validationResult.isValid) {
          setShowMarkEntry(true);
        }
      } else {
        setScanResult({
          isValid: false,
          message: result.message,
          code: code
        });
      }
    } catch (err) {
      console.error('Error processing scan:', err);
      setError('Failed to process scan. Please try again.');
    }
  };

  const handleManualEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const form = e.currentTarget;
    const formData = new FormData(form);
    const code = formData.get('manualCode') as string;
    
    if (!code) {
      setError('Please enter a barcode');
      return;
    }
    
    await handleCodeDetected(code);
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCamera(e.target.value);
  };

  const renderCameraSelector = () => {
    if (cameras.length <= 1) return null;
    
    return (
      <div className="w-full mb-4">
        <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-1">
          Select Camera
        </label>
        <select
          id="camera-select"
          value={selectedCamera}
          onChange={handleCameraChange}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {cameras.map((camera) => (
            <option key={camera.deviceId} value={camera.deviceId}>
              {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const calculateTotal = (subject) => {
    const q1 = parseInt(marks[subject].q1) || 0;
    const q2 = parseInt(marks[subject].q2) || 0;
    const q3 = parseInt(marks[subject].q3) || 0;
    return q1 + q2 + q3;
  };

  const handleMarkChange = (subject, question, value) => {
    // Validate input to ensure it's within range
    let parsedValue = parseInt(value) || 0;
    
    // Set max values based on question type
    const maxValues = {
      q1: 10, // 10 mark * 1 = 10
      q2: 16, // 4 mark * 4 = 16
      q3: 24  // 3 mark * 8 = 24
    };
    
    if (parsedValue > maxValues[question]) {
      parsedValue = maxValues[question];
    }
    
    if (parsedValue < 0) {
      parsedValue = 0;
    }
    
    setMarks(prevMarks => {
      const newMarks = {
        ...prevMarks,
        [subject]: {
          ...prevMarks[subject],
          [question]: parsedValue.toString()
        }
      };
      
      // Calculate and update total
      newMarks[subject].total = (
        parseInt(newMarks[subject].q1) || 0 +
        parseInt(newMarks[subject].q2) || 0 +
        parseInt(newMarks[subject].q3) || 0
      ).toString();
      
      return newMarks;
    });
  };

  const handleSubmitMarks = async () => {
    if (!scanResult || !scanResult.examId || !scanResult.studentId) {
      setError('Missing exam or student information');
      return;
    }
    
    try {
      // Calculate grand total
      const grandTotal = Object.keys(marks).reduce((total, subject) => {
        return total + calculateTotal(subject);
      }, 0);
      
      // Create marks record
      const marksRecord = {
        id: crypto.randomUUID(),
        examId: scanResult.examId,
        studentId: scanResult.studentId,
        marks: JSON.stringify(marks),
        totalMarks: grandTotal,
        recordedBy: userId,
        recordedAt: new Date(),
        notes: `Marks for ${scanResult.examName || 'exam'}`
      };
      
      // Save to database (assuming we add a marks table to our schema)
      // For now, we'll just log it
      console.log('Saving marks:', marksRecord);
      
      // Show success message
      alert(`Marks saved successfully! Total: ${grandTotal}/250`);
      
      // Reset form
      setShowMarkEntry(false);
      setScanResult(null);
      setMarks({
        java: { q1: '', q2: '', q3: '', total: '0' },
        cpp: { q1: '', q2: '', q3: '', total: '0' },
        python: { q1: '', q2: '', q3: '', total: '0' },
        javascript: { q1: '', q2: '', q3: '', total: '0' },
        os: { q1: '', q2: '', q3: '', total: '0' }
      });
    } catch (err) {
      console.error('Error saving marks:', err);
      setError('Failed to save marks. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-4">Exam Barcode Scanner</h2>
        
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        {showMarkEntry && scanResult ? (
          <div className="bg-white rounded-lg">
            <div className="mb-4 p-4 bg-green-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Enter Marks for {scanResult.studentId}</h3>
              <p className="text-sm text-gray-600 mb-2">Exam: {scanResult.examName}</p>
              <p className="text-xs text-gray-500">Barcode: {scanResult.code}</p>
            </div>
            
            <div className="mb-6">
              <div className="grid grid-cols-1 gap-4">
                {Object.keys(marks).map((subject) => (
                  <div key={subject} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3 capitalize">{subject === 'os' ? 'Operating Systems & Lab' : subject}</h4>
                    <div className="grid grid-cols-3 gap-3 mb-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          10 Mark Question (max 10)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={marks[subject].q1}
                          onChange={(e) => handleMarkChange(subject, 'q1', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          4 Mark Questions (max 16)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="16"
                          value={marks[subject].q2}
                          onChange={(e) => handleMarkChange(subject, 'q2', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          3 Mark Questions (max 24)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="24"
                          value={marks[subject].q3}
                          onChange={(e) => handleMarkChange(subject, 'q3', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">Total: {calculateTotal(subject)}/50</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between items-center border-t pt-4">
              <div className="text-lg font-medium">
                Grand Total: {Object.keys(marks).reduce((total, subject) => total + calculateTotal(subject), 0)}/250
              </div>
              <div className="space-x-3">
                <button
                  onClick={() => {
                    setShowMarkEntry(false);
                    setScanResult(null);
                  }}
                  className="px-4 py-2 border rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitMarks}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Save Marks
                </button>
              </div>
            </div>
          </div>
        ) : scanning ? (
          <>
            <div className="relative aspect-square w-full bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              ></video>
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover opacity-0"
              ></canvas>
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2/3 h-2/3 border-2 border-white rounded-lg relative">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 animate-scan"></div>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm font-medium bg-black/50 py-1">
                Position barcode within the frame
              </div>
            </div>
            <button
              onClick={stopScanning}
              className="absolute bottom-4 right-4 bg-red-500 text-white p-3 rounded-full shadow-lg"
            >
              <X size={24} />
            </button>
          </>
        ) : (
          <div className="aspect-square w-full bg-gray-100 rounded-lg flex flex-col items-center justify-center p-6">
            {scanResult ? (
              <div className="text-center">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  scanResult.isValid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {scanResult.isValid ? <Check size={32} /> : <AlertTriangle size={32} />}
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {scanResult.isValid ? 'Valid Barcode' : 'Invalid Barcode'}
                </h3>
                <p className="text-gray-600 mb-2">{scanResult.message}</p>
                
                {scanResult.studentId && (
                  <p className="text-sm font-medium mb-1">
                    Student ID: <span className="font-bold">{scanResult.studentId}</span>
                  </p>
                )}
                
                {scanResult.examName && (
                  <p className="text-sm font-medium mb-4">
                    Exam: <span className="font-bold">{scanResult.examName}</span>
                  </p>
                )}
                
                <p className="text-xs text-gray-500 mb-6 break-all font-mono">
                  Code: {scanResult.code}
                </p>
                <button
                  onClick={() => setScanResult(null)}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md mr-2"
                >
                  Clear
                </button>
                <button
                  onClick={startScanning}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md"
                >
                  Scan Again
                </button>
              </div>
            ) : error ? (
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-lg font-semibold mb-2">Error</h3>
                <p className="text-gray-600 mb-6">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md mr-2"
                >
                  Clear
                </button>
                <button
                  onClick={startScanning}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <Camera size={64} className="text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Exam Barcode Scanner</h3>
                <p className="text-gray-600 mb-6 text-center">
                  Scan exam barcodes to validate and log them in the system.
                </p>
                
                {renderCameraSelector()}
                
                <button
                  onClick={startScanning}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium w-full mb-4"
                >
                  Start Scanning
                </button>
                
                <div className="w-full mt-2">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-gray-100 text-gray-500">Or enter code manually</span>
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
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScannerComponent;