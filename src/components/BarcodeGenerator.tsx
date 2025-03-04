import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { db, Barcode, Exam, addToSyncQueue } from '../db/schema';
import { Download, RefreshCw, Check } from 'lucide-react';
import { getCurrentUser } from '../utils/auth';

const BarcodeGenerator: React.FC = () => {
  const [subject, setSubject] = useState('');
  const [studentId, setStudentId] = useState('');
  const [generatedBarcode, setGeneratedBarcode] = useState<string | null>(null);
  const [barcodeData, setBarcodeData] = useState<Barcode | null>(null);
  const [examData, setExamData] = useState<Exam | null>(null);
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);

  // Predefined subjects
  const predefinedSubjects = [
    'Java',
    'PHP',
    'Python',
    'JavaScript',
    'Operating Systems & Lab'
  ];

  useEffect(() => {
    // Get current user
    const fetchUser = async () => {
      const { isAuthenticated, user } = await getCurrentUser();
      if (isAuthenticated && user) {
        setUserId(user.id);
      }
    };
    
    fetchUser();
  }, []);

  useEffect(() => {
    // Generate barcode SVG when barcode data is available
    if (generatedBarcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, generatedBarcode, {
          format: "CODE128",
          lineColor: "#000",
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 16,
          margin: 10
        });
      } catch (err) {
        console.error('Error generating barcode SVG:', err);
        setError('Failed to generate barcode image');
      }
    }
  }, [generatedBarcode]);

  const generateRandomCode = (prefix: string): string => {
    // Generate a random 6-digit number
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    // Current year
    const year = new Date().getFullYear();
    // Combine to create a barcode format: PREFIX + YEAR + RANDOM
    return `${prefix.toUpperCase().substring(0, 3)}${year}${randomNum}`;
  };

  const handleGenerateBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }
    
    if (!studentId.trim()) {
      setError('Please enter a student ID');
      return;
    }
    
    if (!userId) {
      setError('User not authenticated. Please log in again.');
      return;
    }
    
    setGenerating(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Generate a prefix from the subject (first 3 characters)
      const prefix = subject.substring(0, 3);
      const barcodeValue = generateRandomCode(prefix);
      
      // Create exam record
      const examId = crypto.randomUUID();
      const exam: Exam = {
        id: examId,
        title: `${subject} Exam`,
        subject: subject,
        date: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Create barcode record
      const barcodeId = crypto.randomUUID();
      const barcode: Barcode = {
        id: barcodeId,
        code: barcodeValue,
        examId: examId,
        studentId: studentId,
        isValid: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Save to database
      await db.exams.add(exam);
      await db.barcodes.add(barcode);
      
      // Add to sync queue
      await addToSyncQueue('create', 'exams', examId, exam);
      await addToSyncQueue('create', 'barcodes', barcodeId, barcode);
      
      // Update state
      setGeneratedBarcode(barcodeValue);
      setBarcodeData(barcode);
      setExamData(exam);
      setSuccess(true);
      
    } catch (error) {
      console.error('Error generating barcode:', error);
      setError('Failed to generate barcode. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!barcodeRef.current) return;
    
    try {
      // Create a canvas element
      const canvas = document.createElement('canvas');
      const svg = barcodeRef.current;
      const bbox = svg.getBBox();
      
      // Set canvas dimensions
      canvas.width = bbox.width + 40; // Add some padding
      canvas.height = bbox.height + 40;
      
      // Create a context and set background
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Convert SVG to string
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      // Create image from SVG
      const img = new Image();
      img.onload = () => {
        // Draw image to canvas
        ctx.drawImage(img, 20, 20); // Add padding
        
        // Convert canvas to PNG
        const pngUrl = canvas.toDataURL('image/png');
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `barcode-${generatedBarcode}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Clean up
        URL.revokeObjectURL(url);
      };
      img.src = url;
      
    } catch (err) {
      console.error('Error downloading barcode:', err);
      setError('Failed to download barcode image');
    }
  };

  const handleReset = () => {
    setSubject('');
    setStudentId('');
    setGeneratedBarcode(null);
    setBarcodeData(null);
    setExamData(null);
    setSuccess(false);
    setError(null);
  };

  const handleSubjectSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSubject(e.target.value);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Barcode Generator</h2>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      {success && generatedBarcode && (
        <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4 flex items-center">
          <Check size={18} className="mr-2" />
          Barcode generated successfully!
        </div>
      )}
      
      {!generatedBarcode ? (
        <form onSubmit={handleGenerateBarcode}>
          <div className="mb-4">
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                id="subject-select"
                value={subject}
                onChange={handleSubjectSelect}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a subject</option>
                {predefinedSubjects.map((subj) => (
                  <option key={subj} value={subj}>{subj}</option>
                ))}
                <option value="custom">Custom Subject</option>
              </select>
              
              {subject === 'custom' && (
                <input
                  type="text"
                  id="subject"
                  value={subject === 'custom' ? '' : subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter custom subject name"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              First 3 characters will be used as barcode prefix
            </p>
          </div>
          
          <div className="mb-6">
            <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-1">
              Student ID
            </label>
            <input
              type="text"
              id="studentId"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. STU001"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={generating}
            className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              generating ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {generating ? (
              <>
                <RefreshCw size={18} className="inline mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Barcode'
            )}
          </button>
        </form>
      ) : (
        <div className="flex flex-col items-center">
          <div className="mb-4 p-4 bg-gray-50 rounded-lg w-full flex justify-center">
            <svg ref={barcodeRef} className="w-full max-w-xs"></svg>
          </div>
          
          <div className="mb-6 text-center">
            <p className="text-sm font-medium mb-1">
              Subject: <span className="font-bold">{examData?.subject}</span>
            </p>
            <p className="text-sm font-medium mb-1">
              Student ID: <span className="font-bold">{barcodeData?.studentId}</span>
            </p>
            <p className="text-sm font-medium mb-1">
              Expiry Date: <span className="font-bold">
                {examData?.expiryDate ? new Date(examData.expiryDate).toLocaleDateString() : 'N/A'}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This barcode has been saved to the local database and can be scanned by the application.
            </p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleDownload}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center"
            >
              <Download size={18} className="mr-2" />
              Download
            </button>
            <button
              onClick={handleReset}
              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Generate Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeGenerator;