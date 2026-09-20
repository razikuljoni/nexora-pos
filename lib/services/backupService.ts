// NEXORA POS - Secure Database Backup & Encryption Service (AES-256-GCM / PBKDF2)
import { db } from '../db';
import type { User as StaffUser } from '../types';

export interface DatabaseDumpMetadata {
  exportedAt: string;
  organizationId: string;
  exportedBy: string;
  exportedByRole: string;
  databaseName: string;
  tableCount: number;
  totalRecords: number;
  recordCounts: Record<string, number>;
  checksumSha256: string;
  note?: string;
}

export interface DatabaseDump {
  schemaVersion: number;
  exportedAt: string;
  organizationId: string;
  exportedBy: {
    id: string;
    name: string;
    role: string;
  };
  system: {
    databaseName: string;
    tableCount: number;
    totalRecords: number;
    checksumSha256: string;
    environment: string;
  };
  metadata: DatabaseDumpMetadata;
  tables: Record<string, unknown[]>;
}

export interface EncryptedBackupArchive {
  format: 'NEXORA_ENCRYPTED_BACKUP_V1';
  encrypted: true;
  cipher: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string; // Base64
  iv: string; // Base64
  ciphertext: string; // Base64
  metadata: DatabaseDumpMetadata;
}

export interface UnencryptedBackupArchive {
  format: 'NEXORA_UNENCRYPTED_BACKUP_V1';
  encrypted: false;
  metadata: DatabaseDumpMetadata;
  dump: DatabaseDump;
}

export type BackupArchive = EncryptedBackupArchive | UnencryptedBackupArchive;

export interface DatabaseTableStats {
  tableName: string;
  count: number;
}

export interface DatabaseOverallStats {
  totalRecords: number;
  tableCount: number;
  tableStats: DatabaseTableStats[];
  estimatedSizeBytes: number;
}

// Convert bytes to Base64 safely
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to bytes safely
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Compute SHA-256 hex digest
export async function computeSha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Derive AES-256-GCM key from user passphrase and salt via PBKDF2
async function deriveEncryptionKey(passphrase: string, salt: Uint8Array, iterations: number = 100000): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export const ALL_DATABASE_TABLES = [
  'locations',
  'registers',
  'users',
  'products',
  'categories',
  'sales',
  'heldOrders',
  'shifts',
  'cashMovements',
  'inventoryMovements',
  'suppliers',
  'purchaseOrders',
  'stockTransfers',
  'customers',
  'loyaltyMovements',
  'expenses',
  'auditEvents',
  'syncOutbox',
  'kitchenTickets',
  'printJobs',
] as const;

export type TableName = (typeof ALL_DATABASE_TABLES)[number];

/**
 * Fetch stats for all tables in the local IndexedDB
 */
export async function getDatabaseOverallStats(): Promise<DatabaseOverallStats> {
  const tableStats: DatabaseTableStats[] = [];
  let totalRecords = 0;

  for (const tableName of ALL_DATABASE_TABLES) {
    try {
      const table = db.table(tableName);
      const count = await table.count();
      tableStats.push({ tableName, count });
      totalRecords += count;
    } catch {
      tableStats.push({ tableName, count: 0 });
    }
  }

  // Rough estimation: ~350 bytes average per indexed record + indexes
  const estimatedSizeBytes = totalRecords * 380;

  return {
    totalRecords,
    tableCount: ALL_DATABASE_TABLES.length,
    tableStats,
    estimatedSizeBytes,
  };
}

/**
 * Extracts all table rows and compiles an immutable DatabaseDump
 */
export async function createDatabaseDump(
  currentUser: StaffUser,
  note?: string,
  selectedTables: TableName[] = [...ALL_DATABASE_TABLES]
): Promise<DatabaseDump> {
  const dumpTables: Record<string, unknown[]> = {};
  const recordCounts: Record<string, number> = {};
  let totalRecords = 0;

  for (const tableName of selectedTables) {
    try {
      const table = db.table(tableName);
      const rows = await table.toArray();
      dumpTables[tableName] = rows;
      recordCounts[tableName] = rows.length;
      totalRecords += rows.length;
    } catch (err) {
      console.warn(`Could not export table ${tableName}:`, err);
      dumpTables[tableName] = [];
      recordCounts[tableName] = 0;
    }
  }

  const exportedAt = new Date().toISOString();

  // Temporary object to calculate SHA-256 checksum of the table payload
  const tablePayloadString = JSON.stringify(dumpTables);
  const checksumSha256 = await computeSha256(tablePayloadString);

  const metadata: DatabaseDumpMetadata = {
    exportedAt,
    organizationId: 'org_nexora',
    exportedBy: currentUser.name,
    exportedByRole: currentUser.role,
    databaseName: 'nexora_pos_db',
    tableCount: selectedTables.length,
    totalRecords,
    recordCounts,
    checksumSha256,
    note: note?.trim() || undefined,
  };

  return {
    schemaVersion: 1,
    exportedAt,
    organizationId: 'org_nexora',
    exportedBy: {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    },
    system: {
      databaseName: 'nexora_pos_db',
      tableCount: selectedTables.length,
      totalRecords,
      checksumSha256,
      environment: typeof window !== 'undefined' ? window.location.origin : 'browser',
    },
    metadata,
    tables: dumpTables,
  };
}

/**
 * Creates an encrypted archive payload using AES-256-GCM + PBKDF2
 */
export async function createEncryptedArchive(
  dump: DatabaseDump,
  passphrase: string,
  iterations: number = 100000
): Promise<EncryptedBackupArchive> {
  if (!passphrase || passphrase.length < 6) {
    throw new Error('Encryption passphrase must be at least 6 characters long.');
  }

  // 1. Generate 16 bytes cryptographically secure salt
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  // 2. Generate 12 bytes IV for AES-GCM
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // 3. Derive AES-GCM 256-bit key
  const aesKey = await deriveEncryptionKey(passphrase, salt, iterations);

  // 4. Serialize plaintext dump
  const plaintext = JSON.stringify(dump);
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // 5. Encrypt
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    aesKey,
    plaintextBytes
  );

  const ciphertextBytes = new Uint8Array(ciphertextBuffer);

  return {
    format: 'NEXORA_ENCRYPTED_BACKUP_V1',
    encrypted: true,
    cipher: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertextBytes),
    metadata: dump.metadata,
  };
}

/**
 * Decrypts an encrypted archive back to DatabaseDump
 */
export async function decryptBackupArchive(
  archive: EncryptedBackupArchive,
  passphrase: string
): Promise<DatabaseDump> {
  if (archive.format !== 'NEXORA_ENCRYPTED_BACKUP_V1' || !archive.encrypted) {
    throw new Error('Invalid or unsupported archive format.');
  }

  const salt = base64ToBytes(archive.salt);
  const iv = base64ToBytes(archive.iv);
  const ciphertext = base64ToBytes(archive.ciphertext);

  const aesKey = await deriveEncryptionKey(passphrase, salt, archive.iterations || 100000);

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      aesKey,
      ciphertext as unknown as BufferSource
    );
  } catch {
    throw new Error('Decryption failed. The passphrase entered is incorrect or the archive is corrupted.');
  }

  const decoder = new TextDecoder();
  const decryptedJson = decoder.decode(decryptedBuffer);

  let dump: DatabaseDump;
  try {
    dump = JSON.parse(decryptedJson);
  } catch {
    throw new Error('Decrypted payload is not valid JSON.');
  }

  // Verify integrity checksum
  const tablePayloadString = JSON.stringify(dump.tables);
  const computedChecksum = await computeSha256(tablePayloadString);

  if (archive.metadata?.checksumSha256 && computedChecksum !== archive.metadata.checksumSha256) {
    throw new Error('Checksum mismatch! Data may have been tampered with or corrupted.');
  }

  return dump;
}

/**
 * Triggers a browser file download for the backup archive
 */
export function downloadBackupFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Record an audit log event for the backup export
 */
export async function logBackupAuditEvent(
  currentUser: StaffUser,
  format: 'ENCRYPTED' | 'UNENCRYPTED',
  totalRecords: number,
  checksumSha256: string
): Promise<void> {
  try {
    await db.auditEvents.add({
      id: `audit_backup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: 'DATABASE_BACKUP_EXPORTED',
      entityType: 'DATABASE_BACKUP',
      entityId: 'local_indexeddb',
      locationId: 'loc_hq',
      details: JSON.stringify({
        format,
        cipher: format === 'ENCRYPTED' ? 'AES-256-GCM' : 'PLAINTEXT',
        totalRecords,
        checksumSha256,
      }),
    });
  } catch (err) {
    console.warn('Could not write backup audit event:', err);
  }
}
