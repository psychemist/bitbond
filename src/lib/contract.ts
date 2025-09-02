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
import { NETWORK, CONTRACT_ADDRESS, CONTRACT_NAME, appDetails } from './stacks';
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
  verified: boolean;
  verificationTime?: number;
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

    console.log('Calling openContractCall with options:', options);
    console.log('Contract address being called:', this.contractAddress);
    console.log('Network configuration:', NETWORK);
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.error('Contract call timed out after 60 seconds');
        console.log('🔍 Troubleshooting steps:');
        console.log('1. ✅ Check if Xverse extension popup was blocked by browser');
        console.log('2. ✅ Verify Xverse is connected to Testnet (not Mainnet)');
        console.log('3. ✅ Ensure you have testnet STX for transaction fees');
        console.log('4. ✅ Try refreshing the page and reconnecting wallet');
        console.log('5. ✅ Check if another wallet extension is interfering');
        reject(new Error('Transaction timed out after 60 seconds. Please check if Xverse popup was blocked or if you need to switch to Testnet.'));
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
        
        console.log('✅ openContractCall initiated successfully');
        console.log('🔄 Waiting for Xverse wallet popup...');
        console.log('💡 If no popup appears within 10 seconds:');
        console.log('   - Check browser address bar for popup blocker icon');
        console.log('   - Ensure Xverse is set to Stacks Testnet');
        console.log('   - Try clicking the Xverse extension icon manually');
        
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

  // Read-only functions
  async getTask(taskId: number): Promise<Task | null> {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: this.contractAddress,
        contractName: this.contractName,
        functionName: 'get-task',
        functionArgs: [uintCV(taskId)],
        network: NETWORK,
        senderAddress: this.contractAddress
      });

      const taskData = cvToJSON(result);
      
      if (taskData.type === 'none') {
        return null;
      }

      const task = taskData.value;
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
        verified: task.verified.value,
        verificationTime: task['verification-time']?.value ? parseInt(task['verification-time'].value) : undefined
      };
    } catch (error) {
      console.error('Error fetching task:', error);
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
}

// Export a singleton instance
export const bitBondContract = new BitBondContract();