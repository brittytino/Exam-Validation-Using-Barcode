import jsQR from 'jsqr';
import { db, validateBarcode, ScanLog, addToSyncQueue } from '../db/schema';

// Scanner configuration
const SCAN_INTERVAL = 100; // ms between scan attempts
const SCAN_TIMEOUT = 30000; // 30 seconds timeout for scanning

export interface ScannerOptions {
  onDetected: (result: string) => void;
  onError: (error: Error) => void;
  onStart?: () => void;
  onStop?: () => void;
}

export class BarcodeScanner {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private scanning = false;
  private timeoutId: number | null = null;
  private options: ScannerOptions;

  constructor(options: ScannerOptions) {
    this.options = options;
  }

  public async start(
    videoElement: HTMLVideoElement, 
    canvasElement: HTMLCanvasElement,
    deviceId?: string
  ): Promise<void> {
    if (this.scanning) {
      return;
    }

    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.canvasContext = canvasElement.getContext('2d');

    try {
      // Request camera access with specific device if provided
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } }
          : { facingMode: 'environment' }
      };
      
      console.log('Requesting camera with constraints:', constraints);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!this.videoElement) {
        throw new Error('Video element not initialized');
      }

      this.videoElement.srcObject = this.stream;
      this.videoElement.setAttribute('playsinline', 'true');
      
      // Make sure video starts playing
      await this.videoElement.play().catch(e => {
        console.error('Error playing video:', e);
        throw new Error('Could not start video stream');
      });

      this.scanning = true;
      this.options.onStart?.();

      // Set a timeout for scanning
      this.timeoutId = window.setTimeout(() => {
        this.stop();
        this.options.onError(new Error('Scanning timeout reached'));
      }, SCAN_TIMEOUT);

      this.scanFrame();
    } catch (error) {
      console.error('Camera start error:', error);
      this.options.onError(error instanceof Error ? error : new Error('Unknown error starting scanner'));
    }
  }

  public stop(): void {
    if (!this.scanning) {
      return;
    }

    this.scanning = false;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.options.onStop?.();
  }

  private scanFrame(): void {
    if (!this.scanning || !this.videoElement || !this.canvasElement || !this.canvasContext) {
      return;
    }

    if (this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
      // Draw video frame to canvas
      this.canvasElement.height = this.videoElement.videoHeight;
      this.canvasElement.width = this.videoElement.videoWidth;
      this.canvasContext.drawImage(
        this.videoElement,
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );

      // Get image data for QR code scanning
      const imageData = this.canvasContext.getImageData(
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );

      // Scan for QR code
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code) {
        // QR code detected
        this.stop();
        this.options.onDetected(code.data);
        return;
      }
    }

    // Continue scanning
    requestAnimationFrame(() => this.scanFrame());
  }
}

// Function to process a scanned barcode
export async function processScan(
  code: string,
  userId: string,
  location?: string
): Promise<{
  success: boolean;
  message: string;
  scanLog?: ScanLog;
  examName?: string;
  studentId?: string;
}> {
  try {
    // Validate the barcode
    const validationResult = await validateBarcode(code);
    
    // Create a scan log
    const scanLog: ScanLog = {
      id: crypto.randomUUID(),
      barcodeId: validationResult.barcode?.id || 'unknown',
      examId: validationResult.exam?.id || 'unknown',
      studentId: validationResult.barcode?.studentId || 'unknown',
      status: validationResult.isValid ? 'valid' : validationResult.message.includes('expired') ? 'expired' : 'invalid',
      scannedBy: userId,
      scannedAt: new Date(),
      location,
      deviceId: navigator.userAgent,
      syncStatus: 'pending',
      notes: validationResult.message
    };
    
    // Save the scan log to the database
    await db.scanLogs.add(scanLog);
    
    // Add to sync queue
    await addToSyncQueue('create', 'scanLogs', scanLog.id, scanLog);
    
    return {
      success: true,
      message: validationResult.message,
      scanLog,
      examName: validationResult.exam?.title,
      studentId: validationResult.barcode?.studentId
    };
  } catch (error) {
    console.error('Process scan error:', error);
    return {
      success: false,
      message: 'An error occurred while processing the scan'
    };
  }
}