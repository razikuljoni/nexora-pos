// NEXORA POS - Thermal Print Queue & Hardware Spooler Service
import { db } from '../db';
import type { PrintJob, PrintJobStatus, PrintJobType } from '../types';
import { sound } from '../audio';

export interface PrintQueueSummary {
  total: number;
  queued: number;
  printing: number;
  completed: number;
  failed: number;
  lastJobTime: string | null;
  printers: Array<{
    name: string;
    type: 'THERMAL_80MM' | 'THERMAL_58MM' | 'IMPACT_KITCHEN';
    status: 'ONLINE' | 'OUT_OF_PAPER' | 'WARNING';
    ip?: string;
  }>;
}

class PrintService {
  private listeners: Set<() => void> = new Set();
  private isProcessingQueue: boolean = false;
  private hasInitialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.seedDefaultPrintJobsIfEmpty();
      }, 800);
    }
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('[PrintService] Error in subscriber callback:', err);
      }
    });
  }

  /**
   * Seed realistic demonstration print jobs if the print queue is empty
   */
  public async seedDefaultPrintJobsIfEmpty(): Promise<void> {
    try {
      const count = await db.printJobs.count();
      if (count > 0) return;

      const now = Date.now();
      const demoJobs: PrintJob[] = [
        {
          id: 'pjob_rec_10041',
          type: 'RECEIPT',
          title: 'Receipt #ORD-10041',
          status: 'FAILED',
          createdAt: new Date(now - 8 * 60 * 1000).toISOString(),
          lastAttemptAt: new Date(now - 7 * 60 * 1000).toISOString(),
          error: 'Printer out of paper: 80mm thermal roll sensor 0x0C tripped (Replace roll)',
          retryCount: 2,
          maxRetries: 5,
          printerName: 'Epson TM-T88VI (Network 80mm)',
          paperWidth: '80mm',
          copies: 1,
          targetId: 'ord_10041',
          payloadMetadata: {
            orderNumber: 'ORD-10041',
            totalAmount: 48.75,
            cashierName: 'Elena Rostova',
            customerName: 'Marcus Vance',
            locationName: 'Flagship Downtown',
          },
          payloadRaw: `================================
          NEXORA POS            
       FLAGSHIP DOWNTOWN        
       742 Evergreen Terrace    
       TEL: (555) 019-2834      
================================
Receipt #: ORD-10041
Date/Time: ${new Date(now - 8 * 60 * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
Register : REG-01
Cashier  : Elena Rostova
Customer : Marcus Vance
Type     : DINE_IN (T-04)
--------------------------------
ITEM                   QTY  TOTAL
--------------------------------
Single Origin Cold Brew  2  $11.00
Artisan Avocado Toast    1  $14.50
Truffle Parmesan Fries   1   $9.75
Espresso Double Shot     2   $8.50
--------------------------------
Subtotal:                 $43.75
Tax (8.25%):               $5.00
TOTAL:                    $48.75
--------------------------------
Payment: VISA CREDIT (**** 4892)
Auth Code: #892147
================================
  Thank you for visiting Nexora!
  Scan QR for digital e-receipt
================================`,
        },
        {
          id: 'pjob_zrep_102',
          type: 'Z_REPORT',
          title: 'Shift Z-Report (Shift #SH-102)',
          status: 'FAILED',
          createdAt: new Date(now - 14 * 60 * 1000).toISOString(),
          lastAttemptAt: new Date(now - 12 * 60 * 1000).toISOString(),
          error: 'Connection timeout: Printer 192.168.1.150:9100 unreachable (Spooler dropped)',
          retryCount: 1,
          maxRetries: 5,
          printerName: 'Epson TM-T88VI (Network 80mm)',
          paperWidth: '80mm',
          copies: 2,
          targetId: 'shift_102',
          payloadMetadata: {
            shiftId: 'SH-102',
            totalAmount: 1845.20,
            cashierName: 'Elena Rostova',
            locationName: 'Flagship Downtown',
          },
          payloadRaw: `********************************
      OFFICIAL Z-REPORT #102    
         END OF SHIFT LEDGER    
       NEXORA AUDIT VERIFIED    
********************************
Store    : Flagship Downtown
Register : REG-01
Cashier  : Elena Rostova
Opened   : 08:00 AM
Closed   : 04:00 PM
--------------------------------
GROSS SALES:           $1,985.40
DISCOUNTS:               -$42.00
REFUNDS (2):             -$98.20
--------------------------------
NET REVENUE:           $1,845.20
TOTAL TAX COLLECTED:     $152.23
--------------------------------
TENDER BREAKDOWN:
  CASH:                  $412.50
  CARD / CONTACTLESS:  $1,332.70
  GIFT CARD / LOYALTY:   $100.00
--------------------------------
CASH DRAWER RECONCILIATION:
  Starting Float:        $200.00
  Cash Sales:            $412.50
  Cash Drops / Payouts: -$150.00
  Expected in Drawer:    $462.50
  Actual Counted:        $462.50
  Drawer Variance:         $0.00 (BALANCED)
--------------------------------
Transaction Count:            48
Avg Ticket Value:         $38.44
Audit Hash: 9f2a7b8e11c4d901
********************************`,
        },
        {
          id: 'pjob_kt_108',
          type: 'KITCHEN_TICKET',
          title: 'Kitchen Order #ORD-10045',
          status: 'QUEUED',
          createdAt: new Date(now - 2 * 60 * 1000).toISOString(),
          retryCount: 0,
          maxRetries: 3,
          printerName: 'Kitchen Impact (Line Spooler)',
          paperWidth: '80mm',
          copies: 1,
          targetId: 'kt_108',
          payloadMetadata: {
            orderNumber: 'ORD-10045',
            cashierName: 'Marcus Cole',
            locationName: 'Flagship Downtown',
          },
          payloadRaw: `================================
      KITCHEN EXPEDITE TICKET   
================================
Order #: ORD-10045 (Table #09)
Time   : ${new Date(now - 2 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
Server : Marcus Cole
--------------------------------
[1] 2x WAGYU CHEESEBURGER
    - Medium Rare
    - No Pickles
    - Extra Cheddar
[2] 1x TRUFFLE PARMESAN FRIES
    - Aioli on side
[3] 2x ICED MATCHA LATTE
    - Oat Milk
================================
   RUSH - TABLE WAITING
================================`,
        },
        {
          id: 'pjob_rec_10039',
          type: 'RECEIPT',
          title: 'Receipt #ORD-10039',
          status: 'COMPLETED',
          createdAt: new Date(now - 25 * 60 * 1000).toISOString(),
          completedAt: new Date(now - 25 * 60 * 1000 + 1200).toISOString(),
          retryCount: 0,
          printerName: 'Epson TM-T88VI (Network 80mm)',
          paperWidth: '80mm',
          copies: 1,
          targetId: 'ord_10039',
          payloadMetadata: {
            orderNumber: 'ORD-10039',
            totalAmount: 18.50,
            cashierName: 'Elena Rostova',
            customerName: 'Sarah Jenkins',
            locationName: 'Flagship Downtown',
          },
          payloadRaw: `================================
          NEXORA POS            
       FLAGSHIP DOWNTOWN        
================================
Receipt #: ORD-10039
Date/Time: ${new Date(now - 25 * 60 * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
Register : REG-01
Cashier  : Elena Rostova
Customer : Sarah Jenkins
Type     : TAKEAWAY
--------------------------------
ITEM                   QTY  TOTAL
--------------------------------
Matcha Latte (Large)     1   $6.50
Almond Croissant         2  $12.00
--------------------------------
TOTAL:                    $18.50
Payment: APPLE PAY (VISA #9012)
================================
          THANK YOU!            
================================`,
        },
        {
          id: 'pjob_xrep_101',
          type: 'X_REPORT',
          title: 'Mid-Day X-Audit (Shift #SH-102)',
          status: 'COMPLETED',
          createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
          completedAt: new Date(now - 60 * 60 * 1000 + 1500).toISOString(),
          retryCount: 0,
          printerName: 'Epson TM-T88VI (Network 80mm)',
          paperWidth: '80mm',
          copies: 1,
          targetId: 'xrep_101',
          payloadMetadata: {
            shiftId: 'SH-102',
            totalAmount: 940.00,
            cashierName: 'Elena Rostova',
          },
          payloadRaw: `--------------------------------
       MID-DAY X-AUDIT REPORT   
       NON-RESETTING READING    
--------------------------------
Time     : 12:00 PM
Shift    : SH-102
Register : REG-01
Gross Mid-Day:           $940.00
Transactions:                 24
Drawer Cash on Hand:     $315.00
--------------------------------`,
        },
      ];

      await db.printJobs.bulkAdd(demoJobs);
      this.notify();
    } catch (err) {
      console.warn('[PrintService] Seeding print jobs encountered error:', err);
    }
  }

  /**
   * Enqueue a new print job
   */
  public async enqueuePrintJob(
    jobData: Omit<PrintJob, 'id' | 'createdAt' | 'retryCount'> & {
      id?: string;
      createdAt?: string;
      retryCount?: number;
    }
  ): Promise<PrintJob> {
    const newJob: PrintJob = {
      id: jobData.id || `pjob_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: jobData.type,
      title: jobData.title,
      status: jobData.status || 'QUEUED',
      createdAt: jobData.createdAt || new Date().toISOString(),
      retryCount: jobData.retryCount || 0,
      maxRetries: jobData.maxRetries || 5,
      printerName: jobData.printerName || 'Epson TM-T88VI (Network 80mm)',
      paperWidth: jobData.paperWidth || '80mm',
      copies: jobData.copies || 1,
      targetId: jobData.targetId,
      payloadRaw: jobData.payloadRaw,
      payloadMetadata: jobData.payloadMetadata,
      error: jobData.error,
    };

    await db.printJobs.add(newJob);
    this.notify();
    return newJob;
  }

  /**
   * Retrieve all print jobs with optional filters
   */
  public async getPrintJobs(filters?: {
    status?: PrintJobStatus | 'ALL';
    type?: PrintJobType | 'ALL';
    search?: string;
  }): Promise<PrintJob[]> {
    let collection = db.printJobs.orderBy('createdAt').reverse();
    let jobs = await collection.toArray();

    if (filters?.status && filters.status !== 'ALL') {
      jobs = jobs.filter(j => j.status === filters.status);
    }
    if (filters?.type && filters.type !== 'ALL') {
      jobs = jobs.filter(j => j.type === filters.type);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      jobs = jobs.filter(
        j =>
          j.title.toLowerCase().includes(q) ||
          j.printerName.toLowerCase().includes(q) ||
          (j.error && j.error.toLowerCase().includes(q)) ||
          (j.payloadMetadata?.orderNumber && j.payloadMetadata.orderNumber.toLowerCase().includes(q)) ||
          (j.payloadMetadata?.customerName && j.payloadMetadata.customerName.toLowerCase().includes(q))
      );
    }
    return jobs;
  }

  /**
   * Get summary counts and printer hardware statuses
   */
  public async getPrintQueueSummary(): Promise<PrintQueueSummary> {
    const allJobs = await db.printJobs.toArray();
    const queued = allJobs.filter(j => j.status === 'QUEUED').length;
    const printing = allJobs.filter(j => j.status === 'PRINTING').length;
    const completed = allJobs.filter(j => j.status === 'COMPLETED').length;
    const failed = allJobs.filter(j => j.status === 'FAILED').length;

    let lastJobTime: string | null = null;
    if (allJobs.length > 0) {
      allJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      lastJobTime = allJobs[0].createdAt;
    }

    return {
      total: allJobs.length,
      queued,
      printing,
      completed,
      failed,
      lastJobTime,
      printers: [
        {
          name: 'Epson TM-T88VI (Network 80mm)',
          type: 'THERMAL_80MM',
          status: failed > 0 ? 'WARNING' : 'ONLINE',
          ip: '192.168.1.150:9100',
        },
        {
          name: 'Star TSP100 (USB 58mm)',
          type: 'THERMAL_58MM',
          status: 'ONLINE',
        },
        {
          name: 'Kitchen Impact (Line Spooler)',
          type: 'IMPACT_KITCHEN',
          status: queued > 2 ? 'WARNING' : 'ONLINE',
          ip: '192.168.1.155:9100',
        },
      ],
    };
  }

  /**
   * Retry a specific failed or queued print job
   */
  public async retryPrintJob(
    id: string,
    options?: {
      forceSuccess?: boolean;
      simulateFailure?: boolean;
      failureMessage?: string;
    }
  ): Promise<{ success: boolean; message: string; job: PrintJob }> {
    const existing = await db.printJobs.get(id);
    if (!existing) {
      throw new Error(`Print job ${id} was not found in local spooler database`);
    }

    // Mark as PRINTING
    const attemptTime = new Date().toISOString();
    const nextRetryCount = existing.retryCount + 1;

    await db.printJobs.update(id, {
      status: 'PRINTING',
      lastAttemptAt: attemptTime,
      retryCount: nextRetryCount,
    });
    this.notify();

    // Sound feedback: print feed ticks
    sound.playPrintFeed();

    // Small delay to simulate hardware communication with thermal printer
    await new Promise(resolve => setTimeout(resolve, 850));

    // Determine outcome
    const shouldFail =
      options?.simulateFailure === true ||
      (!options?.forceSuccess && existing.retryCount >= 4 && Math.random() < 0.2);

    if (shouldFail) {
      const errMsg =
        options?.failureMessage ||
        'Printer communication fault: Hardware acknowledgment timeout (0x1B status)';
      await db.printJobs.update(id, {
        status: 'FAILED',
        error: errMsg,
      });
      sound.playError();
      this.notify();
      const updated = (await db.printJobs.get(id))!;
      return {
        success: false,
        message: `Retry failed: ${errMsg}`,
        job: updated,
      };
    } else {
      // Mark as COMPLETED!
      const completedTime = new Date().toISOString();
      await db.printJobs.update(id, {
        status: 'COMPLETED',
        completedAt: completedTime,
        error: undefined,
      });
      sound.playSuccess();
      this.notify();
      const updated = (await db.printJobs.get(id))!;
      return {
        success: true,
        message: `Successfully printed "${existing.title}" on ${existing.printerName}`,
        job: updated,
      };
    }
  }

  /**
   * Retry all failed jobs in queue
   */
  public async retryAllFailedJobs(): Promise<{ succeeded: number; failed: number; processed: number }> {
    const failedJobs = await db.printJobs.filter(j => j.status === 'FAILED').toArray();
    let succeeded = 0;
    let failed = 0;

    for (const job of failedJobs) {
      const result = await this.retryPrintJob(job.id, { forceSuccess: true });
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    this.notify();
    return {
      succeeded,
      failed,
      processed: failedJobs.length,
    };
  }

  /**
   * Cancel or delete a print job
   */
  public async cancelPrintJob(id: string): Promise<void> {
    await db.printJobs.delete(id);
    this.notify();
  }

  /**
   * Clear all completed jobs from history
   */
  public async clearCompletedJobs(): Promise<number> {
    const completed = await db.printJobs.filter(j => j.status === 'COMPLETED').toArray();
    const ids = completed.map(j => j.id);
    await db.printJobs.bulkDelete(ids);
    this.notify();
    return ids.length;
  }

  /**
   * Trigger browser print dialog for thermal receipt payload
   */
  public printJobToBrowser(job: PrintJob): void {
    if (typeof window === 'undefined') return;

    sound.playClick();

    // Create a temporary hidden iframe to render the raw thermal layout for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const paperWidthPx = job.paperWidth === '58mm' ? '58mm' : '80mm';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${job.title}</title>
          <style>
            @page {
              size: ${paperWidthPx} auto;
              margin: 2mm 3mm;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11.5px;
              line-height: 1.25;
              color: #000;
              margin: 0;
              padding: 4px;
              width: ${paperWidthPx};
              white-space: pre-wrap;
              word-break: break-all;
            }
            .header-bar {
              text-align: center;
              font-weight: bold;
              border-bottom: 1px dashed #000;
              padding-bottom: 4px;
              margin-bottom: 6px;
            }
          </style>
        </head>
        <body>
          <div class="header-bar">${job.title.toUpperCase()}</div>
          <div>${job.payloadRaw.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Browser print dialog invocation error:', err);
      } finally {
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1500);
      }
    }, 250);
  }
}

export const printService = new PrintService();
