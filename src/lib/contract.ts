import {
  makeContractCall,
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  standardPrincipalCV,
  uintCV,
  stringAsciiCV,
  boolCV,
  fetchCallReadOnlyFunction,
  cvToJSON,
  hexToCV,
  serializeCV
} from '@stacks/transactions';
import { NETWORK, CONTRACT_ADDRESS, CONTRACT_NAME, appDetails, getCurrentBlockHeight } from './stacks';
import { openContractCall } from '@stacks/connect';

export interface CreateTaskParams {
  buddy: string;
  title: string;
  description: string;
  stakeAmount: number;
  deadline: number;
}

export interface Task {
  taskId: number;
  creator: string;
  buddy: string;
  title: string;
  description: string;
  stakeAmount: number;
  deadline: number;
  status: string;
  createdAt: number;
  markedCompletedAt?: number; // New field for two-phase verification
  verified: boolean;
  verificationTime?: number;
  // UI helpers for datetime display
  createdAtDate: Date;
  deadlineDate: Date;
  markedCompletedAtDate?: Date;
}

export interface UserStats {
  tasksCreated: number;
  tasksCompleted: number;
  tasksFailed: number;
  totalStaked: number;
}

// Contract call wrappers
export class BitBondContract {
  private contractAddress: string;
  private contractName: string;

  constructor(contractAddress: string = CONTRACT_ADDRESS, contractName: string = CONTRACT_NAME) {
    this.contractAddress = contractAddress;
    this.contractName = contractName;
  }

  // Create a new accountability task
  async createTask(params: CreateTaskParams, senderAddress: string): Promise<string> {
    console.log('BitBondContract.createTask called with:', params, senderAddress);
    
    const functionArgs = [
      standardPrincipalCV(params.buddy),
      stringAsciiCV(params.title),
      stringAsciiCV(params.description),
      uintCV(params.stakeAmount),
      uintCV(params.deadline)
    ];

    const options = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'create-task',
      functionArgs,
      network: NETWORK,
      appDetails,
      postConditionMode: PostConditionMode.Allow, // Allow transactions without strict post-conditions
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Transaction timed out after 60 seconds. Please check if popup was blocked or if you need to switch to Testnet.'));
      }, 60000); // Increased to 60 seconds to give more time

      try {
        openContractCall({
          ...options,
          onFinish: (data: { txId: string }) => {
            clearTimeout(timeoutId);
            console.log('✅ Transaction successful! TX ID:', data.txId);
            resolve(data.txId);
          },
          onCancel: () => {
            clearTimeout(timeoutId);
            console.log('❌ Transaction cancelled by user in wallet');
            reject(new Error('Transaction was cancelled by user'));
          },
        });
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ openContractCall failed immediately:', error);
        reject(new Error(`Failed to initiate wallet transaction: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  // Buddy verifies task completion
  async verifyTask(taskId: number, success: boolean, senderAddress: string): Promise<string> {
    const functionArgs = [
      uintCV(taskId),
      boolCV(success)
    ];

    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'verify-task',
      functionArgs,
      validateWithAbi: true,
      network: NETWORK,
      anchorMode: AnchorMode.Any,
    };

    return new Promise((resolve, reject) => {
      openContractCall({
        ...txOptions,
        onFinish: (data) => {
          resolve(data.txId);
        },
        onCancel: () => {
          reject(new Error('Transaction cancelled'));
        },
      });
    });
  }

  // Creator marks task as completed (Phase 1 of two-phase verification)
  async markTaskCompleted(taskId: number, senderAddress: string): Promise<string> {
    const functionArgs = [uintCV(taskId)];

    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'mark-task-completed',
      functionArgs,
      validateWithAbi: true,
      network: NETWORK,
      anchorMode: AnchorMode.Any,
    };

    return new Promise((resolve, reject) => {
      openContractCall({
        ...txOptions,
        onFinish: (data) => {
          resolve(data.txId);
        },
        onCancel: () => {
          reject(new Error('Transaction cancelled'));
        },
      });
    });
  }

  // Handle expired task scenarios (replaces reclaim-expired-stake)
  async handleExpiredTask(taskId: number, senderAddress: string): Promise<string> {
    const functionArgs = [uintCV(taskId)];

    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'handle-expired-task',
      functionArgs,
      validateWithAbi: true,
      network: NETWORK,
      anchorMode: AnchorMode.Any,
    };

    return new Promise((resolve, reject) => {
      openContractCall({
        ...txOptions,
        onFinish: (data) => {
          resolve(data.txId);
        },
        onCancel: () => {
          reject(new Error('Transaction cancelled'));
        },
      });
    });
  }

  // Creator reclaims expired stake
  async reclaimExpiredStake(taskId: number, senderAddress: string): Promise<string> {
    const functionArgs = [uintCV(taskId)];

    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'reclaim-expired-stake',
      functionArgs,
      validateWithAbi: true,
      network: NETWORK,
      anchorMode: AnchorMode.Any,
    };

    return new Promise((resolve, reject) => {
      openContractCall({
        ...txOptions,
        onFinish: (data) => {
          resolve(data.txId);
        },
        onCancel: () => {
          reject(new Error('Transaction cancelled'));
        },
      });
    });
  }

  // Convert block heights to dates using current block height as reference
  private async convertBlockToDate(blockHeight: number): Promise<Date> {
    try {
      const currentBlockHeight = await getCurrentBlockHeight();
      const blockDifference = blockHeight - currentBlockHeight;
      const timeDifferenceMs = blockDifference * 10 * 60 * 1000; // 10 minutes per block
      return new Date(Date.now() + timeDifferenceMs);
    } catch (error) {
      console.error('Error converting block to date:', error);
      // Fallback: estimate based on a reasonable current block (testnet is around 155000-160000)
      const estimatedCurrentBlock = 157000;
      const blockDifference = blockHeight - estimatedCurrentBlock;
      const timeDifferenceMs = blockDifference * 10 * 60 * 1000;
      return new Date(Date.now() + timeDifferenceMs);
    }
  }

  // Read-only functions
  async getTask(taskId: number): Promise<Task | null> {
    try {
      console.log(`Fetching task ${taskId}...`);
      
      const result = await fetchCallReadOnlyFunction({
        contractAddress: this.contractAddress,
        contractName: this.contractName,
        functionName: 'get-task',
        functionArgs: [uintCV(taskId)],
        network: NETWORK,
        senderAddress: this.contractAddress
      });

      const taskData = cvToJSON(result);
      console.log(`Task ${taskId} raw data:`, taskData);
      
      // Handle Clarity optional type - check if it's none
      if (!taskData || taskData.type === 'none' || !taskData.value) {
        console.log(`Task ${taskId} not found (none type or missing value)`);
        return null;
      }

      // For optional types, the actual data is nested: taskData.value.value
      let task;
      if (taskData.value && taskData.value.value) {
        // Handle nested optional structure
        task = taskData.value.value;
      } else if (taskData.value) {
        // Handle direct structure
        task = taskData.value;
      } else {
        console.log(`Task ${taskId} has no value property`);
        return null;
      }

      // Check if task object exists and has the basic structure
      if (!task || typeof task !== 'object') {
        console.log(`Task ${taskId} has invalid structure:`, task);
        return null;
      }

      console.log(`Task ${taskId} extracted data:`, task);

      // Validate that all required fields exist with proper values
      const requiredFields = ['creator', 'buddy', 'title', 'description', 'stake-amount', 'deadline', 'status', 'created-at', 'verified'];
      
      for (const field of requiredFields) {
        if (!task[field] || (task[field].value === undefined && task[field].value !== false)) {
          console.log(`Task ${taskId} missing or invalid field '${field}':`, task[field]);
          return null;
        }
      }

      console.log(`Task ${taskId} successfully parsed:`, {
        creator: task.creator.value,
        buddy: task.buddy.value,
        title: task.title.value,
        status: task.status.value
      });

      // Convert dates properly using current block height as reference
      const createdAtDate = await this.convertBlockToDate(parseInt(task['created-at'].value));
      const deadlineDate = await this.convertBlockToDate(parseInt(task.deadline.value));
      const markedCompletedAtDate = task['marked-completed-at']?.value 
        ? await this.convertBlockToDate(parseInt(task['marked-completed-at'].value))
        : undefined;

      return {
        taskId,
        creator: task.creator.value,
        buddy: task.buddy.value,
        title: task.title.value,
        description: task.description.value,
        stakeAmount: parseInt(task['stake-amount'].value),
        deadline: parseInt(task.deadline.value),
        status: task.status.value,
        createdAt: parseInt(task['created-at'].value),
        markedCompletedAt: task['marked-completed-at']?.value ? parseInt(task['marked-completed-at'].value) : undefined,
        verified: task.verified.value,
        verificationTime: task['verification-time']?.value ? parseInt(task['verification-time'].value) : undefined,
        // Properly converted dates
        createdAtDate,
        deadlineDate,
        markedCompletedAtDate
      };
    } catch (error) {
      console.error(`Error fetching task ${taskId}:`, error);
      return null;
    }
  }

  async getUserStats(userAddress: string): Promise<UserStats> {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: this.contractAddress,
        contractName: this.contractName,
        functionName: 'get-user-stats',
        functionArgs: [standardPrincipalCV(userAddress)],
        network: NETWORK,
        senderAddress: this.contractAddress
      });

      const stats = cvToJSON(result).value;
      return {
        tasksCreated: parseInt(stats['tasks-created'].value),
        tasksCompleted: parseInt(stats['tasks-completed'].value),
        tasksFailed: parseInt(stats['tasks-failed'].value),
        totalStaked: parseInt(stats['total-staked'].value)
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return {
        tasksCreated: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        totalStaked: 0
      };
    }
  }

  async getNextTaskId(): Promise<number> {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: this.contractAddress,
        contractName: this.contractName,
        functionName: 'get-next-task-id',
        functionArgs: [],
        network: NETWORK,
        senderAddress: this.contractAddress
      });

      return parseInt(cvToJSON(result).value);
    } catch (error) {
      console.error('Error fetching next task ID:', error);
      return 1;
    }
  }

  async getContractBalance(): Promise<number> {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: this.contractAddress,
        contractName: this.contractName,
        functionName: 'get-contract-balance',
        functionArgs: [],
        network: NETWORK,
        senderAddress: this.contractAddress
      });

      return parseInt(cvToJSON(result).value);
    } catch (error) {
      console.error('Error fetching contract balance:', error);
      return 0;
    }
  }

  async isTaskExpired(taskId: number): Promise<boolean> {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: this.contractAddress,
        contractName: this.contractName,
        functionName: 'is-task-expired-check',
        functionArgs: [uintCV(taskId)],
        network: NETWORK,
        senderAddress: this.contractAddress
      });

      return cvToJSON(result).value;
    } catch (error) {
      console.error('Error checking if task expired:', error);
      return false;
    }
  }

  // Helper method to get recent tasks (for dashboard display)
  async getRecentTasks(limit: number = 10): Promise<Task[]> {
    try {
      const nextTaskId = await this.getNextTaskId();
      const tasks: Task[] = [];
      
      // Load the most recent tasks
      const tasksToLoad = Math.min(limit, nextTaskId - 1);
      
      for (let i = Math.max(1, nextTaskId - tasksToLoad); i < nextTaskId; i++) {
        try {
          const task = await this.getTask(i);
          if (task) {
            tasks.push(task);
          }
        } catch (error) {
          console.error(`Error loading task ${i}:`, error);
        }
      }
      
      // Sort by creation time, most recent first
      return tasks.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error loading recent tasks:', error);
      return [];
    }
  }

  // Helper method to get user's tasks
  async getUserTasks(userAddress: string): Promise<Task[]> {
    try {
      const nextTaskId = await this.getNextTaskId();
      const userTasks: Task[] = [];
      
      // Check all tasks to find ones created by or involving the user
      for (let i = 1; i < nextTaskId; i++) {
        try {
          const task = await this.getTask(i);
          if (task && (task.creator === userAddress || task.buddy === userAddress)) {
            userTasks.push(task);
          }
        } catch (error) {
          console.error(`Error loading task ${i}:`, error);
        }
      }
      
      // Sort by creation time, most recent first
      return userTasks.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error loading user tasks:', error);
      return [];
    }
  }

  // Get tasks created by user (My Tasks tab) - Updated for V2 contract
  async getTasksByCreator(userAddress: string): Promise<Task[]> {
    try {
      // Use the existing getUserTasks method and filter in JavaScript
      const allTasks = await this.getUserTasks(userAddress);
      return allTasks.filter(task => task.creator === userAddress);
    } catch (error) {
      console.error('Error fetching tasks by creator:', error);
      return [];
    }
  }

  // Get tasks where user is the buddy (Buddy Requests tab) - Updated for V2 contract
  async getTasksByBuddy(userAddress: string): Promise<Task[]> {
    try {
      // Use the existing getUserTasks method and filter in JavaScript
      const allTasks = await this.getUserTasks(userAddress);
      return allTasks.filter(task => task.buddy === userAddress);
    } catch (error) {
      console.error('Error fetching tasks by buddy:', error);
      return [];
    }
  }
}

// Export a singleton instance
export const bitBondContract = new BitBondContract();