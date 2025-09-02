import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label } from '@/components/ui/input';
import { X, Calendar, User, DollarSign, FileText, Target } from 'lucide-react';
import { getCurrentBlockHeight, CONTRACT_ADDRESS, callContractWithRequest, NETWORK, isConnected, getLocalStorage, userSession } from '@/lib/stacks';
import { 
  standardPrincipalCV,
  stringAsciiCV,
  uintCV
} from '@stacks/transactions';

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userAddress: string;
  onTaskCreated: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  open,
  onOpenChange,
  userAddress,
  onTaskCreated
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    buddyAddress: '',
    stakeAmount: '',
    deadline: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submission started', formData);

    if (!CONTRACT_ADDRESS) {
      alert('Contract address is not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS in env.');
      return;
    }
    
    if (!formData.title || !formData.description || !formData.buddyAddress || !formData.stakeAmount || !formData.deadline) {
      alert('Please fill in all fields');
      return;
    }

    const stakeFloat = parseFloat(formData.stakeAmount);
    if (isNaN(stakeFloat) || stakeFloat <= 0) {
      alert('Stake amount must be a positive number');
      return;
    }

    const deadlineDate = new Date(formData.deadline);
    if (isNaN(deadlineDate.getTime())) {
      alert('Invalid deadline');
      return;
    }
    const now = Date.now();
    if (deadlineDate.getTime() <= now) {
      alert('Deadline must be in the future');
      return;
    }

    // Check if user is connected
    if (!isConnected() && !userSession.isUserSignedIn()) {
      alert('Please connect your wallet first');
      return;
    }

    setIsSubmitting(true);
    try {
      const stakeAmountMicroSTX = Math.floor(stakeFloat * 1_000_000); // Convert STX to microSTX

      // Accurate block height based deadline
      const currentBlockHeight = await getCurrentBlockHeight();
      const avgBlockTimeMs = 600_000; // 10 minutes
      const deltaBlocks = Math.max(1, Math.ceil((deadlineDate.getTime() - now) / avgBlockTimeMs));
      const absoluteDeadlineBlock = currentBlockHeight + deltaBlocks;

      console.log('Deadline calculation:', { currentBlockHeight, deltaBlocks, absoluteDeadlineBlock, deadlineDate });

      if (absoluteDeadlineBlock <= currentBlockHeight) {
        alert('Calculated deadline block is not in the future. Try a later datetime.');
        return;
      }

      // Prepare function arguments using CV types
      const functionArgs = [
        standardPrincipalCV(formData.buddyAddress.trim()),
        stringAsciiCV(formData.title.trim()),
        stringAsciiCV(formData.description.trim()),
        uintCV(stakeAmountMicroSTX),
        uintCV(absoluteDeadlineBlock)
      ];

      console.log('Contract call parameters:', {
        contractAddress: CONTRACT_ADDRESS,
        functionArgs,
        network: NETWORK?.chainId === 2147483648 ? "testnet" : "mainnet"
      });

      // Use the working contract call pattern
      const options = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: 'bitbond-escrow',
        functionName: 'create-task',
        functionArgs,
        network: NETWORK,
        onFinish: (data: any) => {
          console.log('✅ Task created successfully:', data);
          alert(`Task created successfully! Transaction ID: ${data.txId || data}`);
          
          // Reset form
          setFormData({
            title: '',
            description: '',
            buddyAddress: '',
            stakeAmount: '',
            deadline: ''
          });

          onTaskCreated();
          onOpenChange(false);
        },
        onCancel: () => {
          console.log('❌ Transaction cancelled by user');
          alert('Transaction was cancelled');
        },
      };

      console.log('Calling callContractWithRequest with options:', options);
      await callContractWithRequest(options);
      
    } catch (error) {
      console.error('Detailed error creating task:', error);
      alert('Failed to create task: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const minDate = new Date().toISOString().slice(0, 16); // Current date and time in YYYY-MM-DDTHH:mm format

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl border-0 p-0 overflow-hidden">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-6 text-white relative">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-3 rounded-full">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Create New Task</h2>
              <p className="text-orange-100 mt-1">Set up your accountability challenge</p>
            </div>
          </div>
        </div>

        {/* Form content */}
        <div className="px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Task Title */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-orange-500" />
                <Label htmlFor="title" className="text-sm font-semibold text-gray-700">
                  Task Title
                </Label>
              </div>
              <Input
                id="title"
                type="text"
                placeholder="e.g., Complete daily workout for 30 days"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="border-gray-200 focus:border-orange-400 focus:ring-orange-400 h-12 text-lg"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold text-gray-700">
                Task Description
              </Label>
              <Textarea
                id="description"
                placeholder="Provide detailed description of what you want to accomplish..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="border-gray-200 focus:border-orange-400 focus:ring-orange-400 min-h-[100px] text-base resize-none"
                required
              />
            </div>

            {/* Buddy Address */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-orange-500" />
                <Label htmlFor="buddyAddress" className="text-sm font-semibold text-gray-700">
                  Accountability Buddy Address
                </Label>
              </div>
              <Input
                id="buddyAddress"
                type="text"
                placeholder="ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
                value={formData.buddyAddress}
                onChange={(e) => handleInputChange('buddyAddress', e.target.value)}
                className="border-gray-200 focus:border-orange-400 focus:ring-orange-400 h-12 font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the Stacks address of someone who will verify your task completion
              </p>
            </div>

            {/* Stake Amount and Deadline Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Stake Amount */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-orange-500" />
                  <Label htmlFor="stakeAmount" className="text-sm font-semibold text-gray-700">
                    Stake Amount (STX)
                  </Label>
                </div>
                <Input
                  id="stakeAmount"
                  type="number"
                  step="0.000001"
                  min="0.1"
                  placeholder="1.0"
                  value={formData.stakeAmount}
                  onChange={(e) => handleInputChange('stakeAmount', e.target.value)}
                  className="border-gray-200 focus:border-orange-400 focus:ring-orange-400 h-12 text-lg"
                  required
                />
                <p className="text-xs text-gray-500">
                  Amount you&lsquo;ll lose if you don&rsquo;t complete the task
                </p>
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  <Label htmlFor="deadline" className="text-sm font-semibold text-gray-700">
                    Deadline
                  </Label>
                </div>
                <Input
                  id="deadline"
                  type="datetime-local"
                  min={minDate}
                  value={formData.deadline}
                  onChange={(e) => handleInputChange('deadline', e.target.value)}
                  className="border-gray-200 focus:border-orange-400 focus:ring-orange-400 h-12 cursor-pointer"
                  style={{ colorScheme: 'light' }}
                  required
                />
                <p className="text-xs text-gray-500">
                  When you need to complete this task
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-12 border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating Task...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4" />
                    <span>Create Task</span>
                  </div>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};