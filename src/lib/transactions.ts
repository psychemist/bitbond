import { STACKS_API_URL } from './stacks';

export type TransactionStatus = 'pending' | 'success' | 'abort_by_response' | 'abort_by_post_condition';

export interface TransactionEvent {
  txId: string;
  status: TransactionStatus;
  blockHeight?: number;
  blockHash?: string;
  receipt?: any;
}

export class TransactionTracker {
  private listeners: Map<string, (event: TransactionEvent) => void> = new Map();
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();

  // Track a specific transaction with polling
  async trackTransaction(txId: string, callback: (event: TransactionEvent) => void): Promise<void> {
    this.listeners.set(txId, callback);

    // Poll transaction status every 10 seconds
    const pollInterval = setInterval(async () => {
      const event = await this.getTransactionStatus(txId);
      if (event) {
        const listener = this.listeners.get(txId);
        if (listener) {
          listener(event);

          // Clean up if transaction is complete
          if (event.status !== 'pending') {
            clearInterval(pollInterval);
            this.listeners.delete(txId);
            this.pollIntervals.delete(txId);
          }
        }
      }
    }, 10000);

    this.pollIntervals.set(txId, pollInterval);
  }

  // Get transaction status via API
  async getTransactionStatus(txId: string): Promise<TransactionEvent | null> {
    try {
      const response = await fetch(`${STACKS_API_URL}/extended/v1/tx/${txId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // Transaction not found yet, might be pending
          return {
            txId,
            status: 'pending'
          };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        txId: data.tx_id,
        status: data.tx_status,
        blockHeight: data.block_height,
        blockHash: data.block_hash,
        receipt: data.tx_result
      };
    } catch (error) {
      console.error('Error fetching transaction status:', error);
      return null;
    }
  }

  // Wait for transaction confirmation
  async waitForConfirmation(txId: string, timeoutMs: number = 300000): Promise<TransactionEvent> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stopTracking(txId);
        reject(new Error('Transaction confirmation timeout'));
      }, timeoutMs);

      this.trackTransaction(txId, (event) => {
        if (event.status !== 'pending') {
          clearTimeout(timeout);
          resolve(event);
        }
      });
    });
  }

  // Stop tracking a specific transaction
  stopTracking(txId: string): void {
    const interval = this.pollIntervals.get(txId);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(txId);
    }
    this.listeners.delete(txId);
  }

  // Cleanup all listeners
  disconnect(): void {
    this.pollIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.pollIntervals.clear();
    this.listeners.clear();
  }
}

// Utility functions for STX amount conversion
export const STX_UTILS = {
  // Convert STX to microSTX (1 STX = 1,000,000 microSTX)
  toMicroStx(stx: number): number {
    return Math.floor(stx * 1000000);
  },

  // Convert microSTX to STX
  fromMicroStx(microStx: number): number {
    return microStx / 1000000;
  },

  // Format STX amount for display
  formatStx(microStx: number): string {
    const stx = this.fromMicroStx(microStx);
    return `${stx.toFixed(6)} STX`;
  },

  // Format STX amount for display (shorter)
  formatStxShort(microStx: number): string {
    const stx = this.fromMicroStx(microStx);
    if (stx >= 1) {
      return `${stx.toFixed(2)} STX`;
    } else {
      return `${(stx * 1000).toFixed(0)}μSTX`;
    }
  }
};

// Block time utilities (Stacks blocks are ~10 minutes)
export const BLOCK_UTILS = {
  AVERAGE_BLOCK_TIME_MS: 10 * 60 * 1000, // 10 minutes in milliseconds

  // Convert blocks to approximate time
  blocksToMs(blocks: number): number {
    return blocks * this.AVERAGE_BLOCK_TIME_MS;
  },

  // Convert time to approximate blocks
  msToBlocks(ms: number): number {
    return Math.ceil(ms / this.AVERAGE_BLOCK_TIME_MS);
  },

  // Get deadline in blocks from now
  getDeadlineBlocks(deadlineDate: Date, currentBlockHeight: number = 0): number {
    const now = new Date();
    const timeDiffMs = deadlineDate.getTime() - now.getTime();
    const blocksFromNow = this.msToBlocks(timeDiffMs);
    return currentBlockHeight + Math.max(1, blocksFromNow); // Ensure at least 1 block in future
  },

  // Format deadline for display
  formatDeadline(deadlineBlock: number, currentBlock: number): string {
    const blocksRemaining = deadlineBlock - currentBlock;
    
    if (blocksRemaining <= 0) {
      return 'Expired';
    }

    const timeRemainingMs = this.blocksToMs(blocksRemaining);
    const hours = Math.floor(timeRemainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    } else if (hours >= 1) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }
};

// Error handling utilities
export const CONTRACT_ERRORS = {
  100: 'Owner only',
  101: 'Not found',
  102: 'Unauthorized',
  103: 'Invalid amount',
  104: 'Task expired',
  105: 'Task already verified',
  106: 'Insufficient balance',
  107: 'Same user',
  108: 'Invalid deadline'
} as const;

export function getErrorMessage(errorCode: number): string {
  return CONTRACT_ERRORS[errorCode as keyof typeof CONTRACT_ERRORS] || `Unknown error: ${errorCode}`;
}

// Export singleton tracker
export const transactionTracker = new TransactionTracker();