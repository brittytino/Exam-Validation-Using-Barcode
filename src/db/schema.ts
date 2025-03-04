import Dexie, { Table } from 'dexie';

// Define interfaces for our database tables
export interface Exam {
  id: string;
  title: string;
  subject: string;
  date: string;
  expiryDate: string;
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date;
}

export interface Barcode {
  id: string;
  code: string;
  examId: string;
  studentId: string;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date;
}

export interface ScanLog {
  id: string;
  barcodeId: string;
  examId: string;
  studentId: string;
  status: 'valid' | 'invalid' | 'expired' | 'unknown';
  scannedBy: string;
  scannedAt: Date;
  location?: string;
  deviceId?: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncedAt?: Date;
  notes?: string;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string; // Store hashed password for offline auth
  role: 'admin' | 'examiner' | 'invigilator';
  lastLogin: Date;
  syncedAt?: Date;
}

export interface ExamMarks {
  id: string;
  examId: string;
  studentId: string;
  marks: string; // JSON stringified marks data
  totalMarks: number;
  recordedBy: string;
  recordedAt: Date;
  syncStatus?: 'pending' | 'synced' | 'failed';
  syncedAt?: Date;
  notes?: string;
}

export interface SyncQueue {
  id: string;
  action: 'create' | 'update' | 'delete';
  table: 'exams' | 'barcodes' | 'scanLogs' | 'users' | 'examMarks';
  recordId: string;
  data: string; // JSON stringified data
  attempts: number;
  createdAt: Date;
  lastAttempt?: Date;
}

// Define the database
class ExamDatabase extends Dexie {
  exams!: Table<Exam>;
  barcodes!: Table<Barcode>;
  scanLogs!: Table<ScanLog>;
  users!: Table<User>;
  examMarks!: Table<ExamMarks>;
  syncQueue!: Table<SyncQueue>;

  constructor() {
    super('ExamDatabase');
    this.version(1).stores({
      exams: 'id, subject, date, expiryDate',
      barcodes: 'id, code, examId, studentId, isValid',
      scanLogs: 'id, barcodeId, examId, studentId, status, scannedAt, syncStatus',
      users: 'id, username, role',
      examMarks: 'id, examId, studentId, totalMarks, recordedAt, syncStatus',
      syncQueue: 'id, action, table, recordId, attempts, createdAt'
    });
  }
}

export const db = new ExamDatabase();

// Helper functions for database operations
export async function addToSyncQueue(
  action: 'create' | 'update' | 'delete',
  table: 'exams' | 'barcodes' | 'scanLogs' | 'users' | 'examMarks',
  recordId: string,
  data: any
): Promise<void> {
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    action,
    table,
    recordId,
    data: JSON.stringify(data),
    attempts: 0,
    createdAt: new Date()
  });
}

export async function isExamExpired(examId: string): Promise<boolean> {
  const exam = await db.exams.get(examId);
  if (!exam) return true;
  
  const expiryDate = new Date(exam.expiryDate);
  return expiryDate < new Date();
}

export async function validateBarcode(code: string): Promise<{
  isValid: boolean;
  barcode?: Barcode;
  exam?: Exam;
  message: string;
}> {
  const barcode = await db.barcodes.where('code').equals(code).first();
  
  if (!barcode) {
    return { isValid: false, message: 'Barcode not found in database' };
  }
  
  if (!barcode.isValid) {
    return { isValid: false, barcode, message: 'Barcode marked as invalid' };
  }
  
  const exam = await db.exams.get(barcode.examId);
  
  if (!exam) {
    return { isValid: false, barcode, message: 'Associated exam not found' };
  }
  
  if (await isExamExpired(exam.id)) {
    return { isValid: false, barcode, exam, message: 'Exam has expired' };
  }
  
  return { isValid: true, barcode, exam, message: 'Barcode is valid' };
}

// Function to save exam marks
export async function saveExamMarks(
  examId: string,
  studentId: string,
  marksData: any,
  totalMarks: number,
  recordedBy: string,
  notes?: string
): Promise<string> {
  try {
    // Generate a unique ID for the marks record
    const id = crypto.randomUUID();
    
    // Create the exam marks object
    const examMarks: ExamMarks = {
      id,
      examId,
      studentId,
      marks: JSON.stringify(marksData),
      totalMarks,
      recordedBy,
      recordedAt: new Date(),
      syncStatus: 'pending',
      notes
    };
    
    // Save to IndexedDB
    await db.examMarks.add(examMarks);
    
    // Also save to localStorage as a backup
    try {
      const existingMarks = JSON.parse(localStorage.getItem('examMarks') || '[]');
      existingMarks.push(examMarks);
      localStorage.setItem('examMarks', JSON.stringify(existingMarks));
    } catch (localStorageError) {
      console.warn('Failed to save to localStorage, continuing with IndexedDB only:', localStorageError);
    }
    
    // Add to sync queue for future syncing
    await addToSyncQueue('create', 'examMarks', id, examMarks);
    
    return id;
  } catch (error) {
    console.error('Error saving exam marks:', error);
    
    // Fallback to localStorage if IndexedDB fails
    try {
      const id = crypto.randomUUID();
      const examMarks = {
        id,
        examId,
        studentId,
        marks: JSON.stringify(marksData),
        totalMarks,
        recordedBy,
        recordedAt: new Date(),
        syncStatus: 'pending',
        notes
      };
      
      const existingMarks = JSON.parse(localStorage.getItem('examMarks') || '[]');
      existingMarks.push(examMarks);
      localStorage.setItem('examMarks', JSON.stringify(existingMarks));
      
      return id;
    } catch (fallbackError) {
      console.error('Fallback to localStorage also failed:', fallbackError);
      throw new Error('Failed to save exam marks to any storage mechanism');
    }
  }
}

// Function to get exam marks by exam ID and student ID
export async function getExamMarks(examId: string, studentId: string): Promise<ExamMarks | null> {
  try {
    // Try to get from IndexedDB first
    const marks = await db.examMarks
      .where('examId')
      .equals(examId)
      .and(item => item.studentId === studentId)
      .first();
    
    if (marks) {
      return marks;
    }
    
    // If not found in IndexedDB, try localStorage
    try {
      const storedMarks = localStorage.getItem('examMarks');
      if (storedMarks) {
        const allMarks = JSON.parse(storedMarks) as ExamMarks[];
        const match = allMarks.find(m => m.examId === examId && m.studentId === studentId);
        return match || null;
      }
    } catch (localStorageError) {
      console.warn('Failed to read from localStorage:', localStorageError);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting exam marks:', error);
    return null;
  }
}