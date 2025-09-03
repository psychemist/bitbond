import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  User, 
  Target,
  Calendar,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import { BitBondContract, Task } from '@/lib/contract';
import { formatSTX, callContractWithRequest, NETWORK } from '@/lib/stacks';
import { uintCV, boolCV } from '@stacks/transactions';
import toast from 'react-hot-toast';

interface TaskTabsProps {
  userAddress: string;
  onTaskUpdate: () => void;
}

type TabType = 'my-tasks' | 'buddy-requests' | 'completed';

export const TaskTabs: React.FC<TaskTabsProps> = ({ userAddress, onTaskUpdate }) => {
  const [activeTab, setActiveTab] = useState<TabType>('my-tasks');
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [buddyTasks, setBuddyTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contract] = useState(new BitBondContract());

  // Load tasks for all tabs
  const loadTasks = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Get all user tasks (both created and as buddy)
      const allUserTasks = await contract.getUserTasks(userAddress);
      
      // Filter tasks by role and status for the new two-phase system
      const createdTasks = allUserTasks.filter(task => 
        task.creator === userAddress && 
        (task.status === 'active' || task.status === 'pending-verification') && 
        !task.verified
      );
      
      const buddyRequestTasks = allUserTasks.filter(task => 
        task.buddy === userAddress && 
        task.status === 'pending-verification' && 
        !task.verified
      );
      
      const completedTasks = allUserTasks.filter(task => task.verified)
        .sort((a, b) => b.createdAt - a.createdAt);

      setMyTasks(createdTasks);
      setBuddyTasks(buddyRequestTasks);
      setCompletedTasks(completedTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [contract, userAddress]);

  useEffect(() => {
    if (userAddress) {
      loadTasks();
    }
  }, [userAddress, loadTasks]);

  // Handle task verification
  const handleVerifyTask = async (taskId: number, success: boolean) => {
    setIsSubmitting(true);
    try {
      const options = {
        contractAddress: contract['contractAddress'],
        contractName: contract['contractName'],
        functionName: 'verify-task',
        functionArgs: [uintCV(taskId), boolCV(success)],
        network: NETWORK,
        onFinish: (data: any) => {
          console.log('✅ Task verified successfully:', data);
          toast.success(`Task ${success ? 'approved' : 'rejected'} successfully!`, {
            duration: 5000,
          });
          setIsVerifyModalOpen(false);
          setSelectedTask(null);
          loadTasks();
          onTaskUpdate();
        },
        onCancel: () => {
          console.log('❌ Verification cancelled');
          toast.error('Verification was cancelled');
        },
      };

      await callContractWithRequest(options);
    } catch (error) {
      console.error('Error verifying task:', error);
      toast.error('Failed to verify task: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle marking task as completed (Phase 1)
  const handleMarkCompleted = async (taskId: number) => {
    setIsSubmitting(true);
    try {
      const options = {
        contractAddress: contract['contractAddress'],
        contractName: contract['contractName'],
        functionName: 'mark-task-completed',
        functionArgs: [uintCV(taskId)],
        network: NETWORK,
        onFinish: (data: any) => {
          console.log('✅ Task marked as completed successfully:', data);
          toast.success('Task marked as completed! Now waiting for buddy verification.', {
            duration: 5000,
          });
          loadTasks();
          onTaskUpdate();
        },
        onCancel: () => {
          console.log('❌ Mark completed cancelled');
          toast.error('Mark completed was cancelled');
        },
      };

      await callContractWithRequest(options);
    } catch (error) {
      console.error('Error marking task completed:', error);
      toast.error('Failed to mark task completed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle expired task scenarios (replaces emergency reclaim)
  const handleExpiredTask = async (taskId: number) => {
    setIsSubmitting(true);
    try {
      const options = {
        contractAddress: contract['contractAddress'],
        contractName: contract['contractName'],
        functionName: 'handle-expired-task',
        functionArgs: [uintCV(taskId)],
        network: NETWORK,
        onFinish: (data: any) => {
          console.log('✅ Expired task handled successfully:', data);
          toast.success('Expired task handled successfully!', {
            duration: 5000,
          });
          loadTasks();
          onTaskUpdate();
        },
        onCancel: () => {
          console.log('❌ Handle expired cancelled');
          toast.error('Handle expired was cancelled');
        },
      };

      await callContractWithRequest(options);
    } catch (error) {
      console.error('Error handling expired task:', error);
      toast.error('Failed to handle expired task: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTaskStatusColor = (task: Task) => {
    if (task.status === 'completed') return 'bg-green-100 text-green-800';
    if (task.status === 'failed') return 'bg-red-100 text-red-800';
    if (task.status === 'expired') return 'bg-gray-100 text-gray-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getTaskStatusIcon = (task: Task) => {
    if (task.status === 'completed') return <CheckCircle className="h-4 w-4" />;
    if (task.status === 'failed') return <XCircle className="h-4 w-4" />;
    if (task.status === 'expired') return <AlertTriangle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const TaskCard: React.FC<{ task: Task; showActions: boolean; isCreator: boolean }> = ({ 
    task, 
    showActions, 
    isCreator 
  }) => (
    <Card className="border-l-4 border-l-orange-400">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{task.title}</CardTitle>
          <Badge className={getTaskStatusColor(task)}>
            {getTaskStatusIcon(task)}
            <span className="ml-1">{task.status}</span>
          </Badge>
        </div>
        <CardDescription>{task.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4" />
              <span>Stake: {formatSTX(BigInt(task.stakeAmount))} STX</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>Deadline: {task.deadlineDate.toLocaleDateString()} {task.deadlineDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <User className="h-4 w-4" />
              <span>{isCreator ? 'Buddy' : 'Creator'}: {(isCreator ? task.buddy : task.creator).substring(0, 8)}...</span>
            </div>
            <span>Created: {task.createdAtDate.toLocaleDateString()} {task.createdAtDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>

          {/* Show marked completed status for pending verification */}
          {task.status === 'pending-verification' && task.markedCompletedAtDate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <div className="flex items-center space-x-2 text-sm text-blue-700">
                <CheckCircle className="h-4 w-4" />
                <span>Marked complete: {task.markedCompletedAtDate.toLocaleDateString()} at {task.markedCompletedAtDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">Waiting for buddy verification within 48 hours</p>
            </div>
          )}

          {showActions && (
            <div className="flex space-x-2 pt-2">
              {/* Buddy verification button - should show for pending-verification tasks */}
              {!isCreator && task.status === 'pending-verification' && !task.verified && (
                <Button
                  onClick={() => {
                    setSelectedTask(task);
                    setIsVerifyModalOpen(true);
                  }}
                  size="sm"
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold shadow-lg"
                >
                  <Target className="h-4 w-4 mr-1" />
                  Verify Task
                </Button>
              )}
              
              {/* Creator mark completed button - for active tasks */}
              {isCreator && task.status === 'active' && !task.verified && (
                <Button
                  onClick={() => handleMarkCompleted(task.taskId)}
                  disabled={isSubmitting}
                  size="sm"
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold shadow-lg"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark Completed
                </Button>
              )}

              {/* Creator expired task handler */}
              {isCreator && task.status === 'expired' && (
                <Button
                  onClick={() => handleExpiredTask(task.taskId)}
                  disabled={isSubmitting}
                  size="sm"
                  variant="outline"
                  className="text-orange-600 border-orange-600 hover:bg-orange-50"
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Handle Expired
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const getTabCount = (tab: TabType) => {
    switch (tab) {
      case 'my-tasks': return myTasks.length;
      case 'buddy-requests': return buddyTasks.length;
      case 'completed': return completedTasks.length;
      default: return 0;
    }
  };

  return (
    <div className="w-full">
      {/* Tab Navigation with Refresh Button */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <nav className="flex space-x-8">
            {[
              { key: 'my-tasks' as TabType, label: 'My Tasks', icon: Target },
              { key: 'buddy-requests' as TabType, label: 'Buddy Requests', icon: User },
              { key: 'completed' as TabType, label: 'Completed', icon: CheckCircle }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === key
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                {getTabCount(key) > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {getTabCount(key)}
                  </Badge>
                )}
              </button>
            ))}
          </nav>
          
          <Button
            onClick={() => {
              loadTasks();
              toast.success('Tasks refreshed!');
            }}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading tasks...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'my-tasks' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Tasks You Created</h3>
              {myTasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No active tasks. Create your first task to get started!</p>
              ) : (
                <div className="space-y-4">
                  {myTasks.map(task => (
                    <TaskCard key={task.taskId} task={task} showActions={true} isCreator={true} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'buddy-requests' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Tasks Awaiting Your Verification</h3>
              {buddyTasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No pending verification requests.</p>
              ) : (
                <div className="space-y-4">
                  {buddyTasks.map(task => (
                    <TaskCard key={task.taskId} task={task} showActions={true} isCreator={false} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'completed' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Completed Tasks</h3>
              {completedTasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No completed tasks yet.</p>
              ) : (
                <div className="space-y-4">
                  {completedTasks.map(task => (
                    <TaskCard 
                      key={task.taskId} 
                      task={task} 
                      showActions={false} 
                      isCreator={task.creator === userAddress} 
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Verification Modal */}
      <Dialog open={isVerifyModalOpen} onOpenChange={setIsVerifyModalOpen}>
        <DialogContent className="max-w-lg mx-auto bg-white rounded-2xl shadow-2xl border-0 p-0 overflow-hidden">
          {/* Header with gradient background */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 text-white relative">
            <button
              onClick={() => setIsVerifyModalOpen(false)}
              className="absolute right-4 top-4 p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <XCircle className="h-5 w-5" />
            </button>
            
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-3 rounded-full">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Verify Task Completion</h2>
                <p className="text-orange-100 text-sm mt-1">Review and verify the task completion</p>
              </div>
            </div>
          </div>

          {/* Content */}
          {selectedTask && (
            <div className="p-6 space-y-6">
              {/* Task Details Card */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-800 mb-2">{selectedTask.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{selectedTask.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-orange-500" />
                    <span className="font-semibold text-gray-700">Stake Amount</span>
                  </div>
                  <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-bold">
                    {formatSTX(BigInt(selectedTask.stakeAmount))} STX
                  </div>
                </div>
              </div>

              {/* Decision Message */}
              <div className="text-center py-2">
                <p className="text-gray-600 font-medium">
                  Has this task been completed successfully?
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Your decision will determine if the stake is returned or forfeited
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handleVerifyTask(selectedTask.taskId, true)}
                  disabled={isSubmitting}
                  className="h-14 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSubmitting ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5" />
                      <div>
                        <div className="text-sm font-bold">✅ Approve</div>
                        <div className="text-xs opacity-90">Return Stake</div>
                      </div>
                    </div>
                  )}
                </Button>

                <Button
                  onClick={() => handleVerifyTask(selectedTask.taskId, false)}
                  disabled={isSubmitting}
                  className="h-14 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSubmitting ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <XCircle className="h-5 w-5" />
                      <div>
                        <div className="text-sm font-bold">❌ Reject</div>
                        <div className="text-xs opacity-90">Forfeit Stake</div>
                      </div>
                    </div>
                  )}
                </Button>
              </div>
              
              {/* Cancel Button */}
              <Button
                variant="outline"
                onClick={() => setIsVerifyModalOpen(false)}
                disabled={isSubmitting}
                className="w-full h-12 border-2 border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold rounded-xl transition-colors"
              >
                Cancel Verification
              </Button>

              {/* Warning Text */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-700">
                    <p className="font-semibold">⚠️ Important Decision</p>
                    <p className="mt-1">This action cannot be undone. Make sure you&lsquo;ve verified the task completion before proceeding.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};