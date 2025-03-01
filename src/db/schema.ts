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

export interface SyncQueue {
  id: string;
  action: 'create' | 'update' | 'delete';
  table: 'exams' | 'barcodes' | 'scanLogs' | 'users';
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
  syncQueue!: Table<SyncQueue>;

  constructor() {
    super('ExamDatabase');
    this.version(1).stores({
      exams: 'id, subject, date, expiryDate',
      barcodes: 'id, code, examId, studentId, isValid',
      scanLogs: 'id, barcodeId, examId, studentId, status, scannedAt, syncStatus',
      users: 'id, username, role',
      syncQueue: 'id, action, table, recordId, attempts, createdAt'
    });
  }
}

export const db = new ExamDatabase();

// Helper functions for database operations
export async function addToSyncQueue(
  action: 'create' | 'update' | 'delete',
  table: 'exams' | 'barcodes' | 'scanLogs' | 'users',
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