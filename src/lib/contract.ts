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
  hexToCV
} from '@stacks/transactions';
import { NETWORK, CONTRACT_ADDRESS, CONTRACT_NAME } from './stacks';
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
    const functionArgs = [
      standardPrincipalCV(params.buddy),
      stringAsciiCV(params.title),
      stringAsciiCV(params.description),
      uintCV(params.stakeAmount),
      uintCV(params.deadline)
    ];

    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'create-task',
      functionArgs,
      senderKey: '', // Will be handled by wallet
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
}

// Export a singleton instance
export const bitBondContract = new BitBondContract();