import React, { useRef, useState, useEffect } from 'react';
import { BarcodeScanner, processScan } from '../utils/scanner';
import { Camera, X, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { getCurrentUser } from '../utils/auth';

interface ScanResult {
  code: string;
  isValid: boolean;
  message: string;
  studentId?: string;
  examName?: string;
}

const ScannerComponent: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [loadingCameras, setLoadingCameras] = useState(false);

  useEffect(() => {
    // Get current user
    const fetchUser = async () => {
      const { isAuthenticated, user } = await getCurrentUser();
      if (isAuthenticated && user) {
        setUserId(user.id);
      }
    };
    
    fetchUser();
    
    // Check for camera permissions
    checkCameraPermission();
    
    // List available cameras
    listCameras();
    
    // Clean up on unmount
    return () => {
      if (scanner.current) {
        scanner.current.stop();
      }
    };
  }, []);

  const scanner = useRef(
    new BarcodeScanner({
      onDetected: (result: string) => {
        setScanning(false);
        handleScanComplete(result);
      },
      onError: (error: Error) => {
        setScanning(false);
        setError(error.message);
      },
      onStart: () => {
        setScanning(true);
        setError(null);
        setScanResult(null);
      },
      onStop: () => {
        setScanning(false);
      }
    })
  );

  const checkCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraPermission(true);
      
      // Stop the stream immediately after checking permission
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Camera permission error:', error);
      setCameraPermission(false);
    }
  };

  const listCameras = async () => {
    try {
      setLoadingCameras(true);
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
      // Select the first camera by default (usually the back camera on mobile)
      if (videoDevices.length > 0) {
        // Try to find a back camera first (environment facing)
        const backCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear')
        );
        
        setSelectedCamera(backCamera ? backCamera.deviceId : videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Error listing cameras:', error);
    } finally {
      setLoadingCameras(false);
    }
  };

  const startScanning = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Camera elements not initialized. Please refresh the page and try again.');
      return;
    }

    if (!userId) {
      setError('User not authenticated. Please log in again.');
      return;
    }

    if (!cameraPermission) {
      setError('Camera permission denied. Please allow camera access in your browser settings.');
      return;
    }

    scanner.current.start(videoRef.current, canvasRef.current, selectedCamera);
  };

  const stopScanning = () => {
    scanner.current.stop();
  };

  const handleScanComplete = async (code: string) => {
    if (!userId) {
      setError('User not authenticated');
      return;
    }

    try {
      // Get geolocation if available
      let location: string | undefined;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 0
          });
        });
        
        location = `${position.coords.latitude},${position.coords.longitude}`;
      } catch (error) {
        console.warn('Geolocation not available:', error);
      }
      
      // Process the scan
      const result = await processScan(code, userId, location);
      
      setScanResult({
        code,
        isValid: result.success && result.scanLog?.status === 'valid',
        message: result.message,
        studentId: result.scanLog?.studentId,
        examName: result.examName
      });
    } catch (error) {
      setError('Failed to process scan');
      console.error('Scan processing error:', error);
    }
  };

  const handleManualEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const codeInput = form.elements.namedItem('manualCode') as HTMLInputElement;
    
    if (codeInput && codeInput.value) {
      handleScanComplete(codeInput.value);
      codeInput.value = '';
    }
  };

  const renderCameraSelector = () => {
    if (availableCameras.length <= 1) return null;
    
    return (
      <div className="mb-4">
        <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-1">
          Select Camera
        </label>
        <select
          id="camera-select"
          value={selectedCamera}
          onChange={(e) => setSelectedCamera(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          disabled={scanning || loadingCameras}
        >
          {availableCameras.map((camera) => (
            <option key={camera.deviceId} value={camera.deviceId}>
              {camera.label || `Camera ${camera.deviceId.substring(0, 5)}...`}
            </option>
          ))}
        </select>
      </div>
    );
  };

  if (cameraPermission === false) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">Camera Access Denied</h3>
          <p className="text-red-600 mb-4">
            This application needs camera access to scan barcodes. Please allow camera access in your browser settings.
          </p>
          <button
            onClick={checkCameraPermission}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-md">
        {scanning ? (
          <>
            <div className="relative aspect-square w-full bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                muted
                playsInline
                autoPlay
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full opacity-0"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2/3 h-2/3 border-2 border-white/70 rounded-lg flex items-center justify-center">
                  <div className="w-full h-full relative">
                    {/* Scanning animation */}
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