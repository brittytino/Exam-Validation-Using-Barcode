import { db, Exam, Barcode, User } from '../db/schema';

// Function to seed the database with initial data for testing
export async function seedDatabase(): Promise<void> {
  try {
    // Check if database is already seeded
    const userCount = await db.users.count();
    
    if (userCount > 0) {
      console.log('Database already seeded');
      return;
    }
    
    console.log('Seeding database...');
    
    // Create users
    const users: User[] = [
      {
        id: '1',
        username: 'admin',
        passwordHash: '14c4b06b824ec593239362517f538b29', // 'admin'
        role: 'admin',
        lastLogin: new Date()
      },
      {
        id: '2',
        username: 'examiner',
        passwordHash: '098f6bcd4621d373cade4e832627b4f6', // 'test'
        role: 'examiner',
        lastLogin: new Date()
      }
    ];
    
    // Create exams
    const exams: Exam[] = [
      {
        id: '1',
        title: 'Mathematics Final Exam',
        subject: 'Mathematics',
        date: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        title: 'Physics Midterm',
        subject: 'Physics',
        date: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3',
        title: 'Computer Science Exam',
        subject: 'Computer Science',
        date: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '4',
        title: 'Biology Final',
        subject: 'Biology',
        date: new Date().toISOString(),
        expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago (expired)
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Create barcodes
    const barcodes: Barcode[] = [
      {
        id: '1',
        code: 'MATH2023001',
        examId: '1',
        studentId: 'STU001',
        isValid: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        code: 'MATH2023002',
        examId: '1',
        studentId: 'STU002',
        isValid: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3',
        code: 'PHYS2023001',
        examId: '2',
        studentId: 'STU001',
        isValid: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '4',
        code: 'PHYS2023002',
        examId: '2',
        studentId: 'STU003',
        isValid: false, // Invalid barcode for testing
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '5',
        code: 'CS2023001',
        examId: '3',
        studentId: 'STU004',
        isValid: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '6',
        code: 'CS2023002',
        examId: '3',
        studentId: 'STU005',
        isValid: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '7',
        code: 'BIO2023001',
        examId: '4', // Expired exam
        studentId: 'STU006',
        isValid: true, // Valid barcode but expired exam
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Add data to database
    await db.users.bulkAdd(users);
    await db.exams.bulkAdd(exams);
    await db.barcodes.bulkAdd(barcodes);
    
    console.log('Database seeded successfully with users:', users.map(u => u.username).join(', '));
    console.log('Added exams:', exams.length);
    console.log('Added barcodes:', barcodes.length);
    
    // Add some sample scan logs for demonstration
    const sampleLogs: ScanLog[] = [
      {
        id: crypto.randomUUID(),
        barcodeId: '1',
        examId: '1',
        studentId: 'STU001',
        status: 'valid',
        scannedBy: '1',
        scannedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        syncStatus: 'synced',
        syncedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
        notes: 'Barcode is valid'
      },
      {
        id: crypto.randomUUID(),
        barcodeId: '4',
        examId: '2',
        studentId: 'STU003',
        status: 'invalid',
        scannedBy: '2',
        scannedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        syncStatus: 'pending',
        notes: 'Barcode marked as invalid'
      }
    ];
    
    await db.scanLogs.bulkAdd(sampleLogs);
    console.log('Added sample scan logs:', sampleLogs.length);
    
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Define the ScanLog interface here to avoid circular dependency
interface ScanLog {
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