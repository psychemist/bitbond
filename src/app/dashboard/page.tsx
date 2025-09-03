'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateTaskModal } from '@/components/CreateTaskModal';
import { TaskTabs } from '@/components/TaskTabs';
import { BitBondContract } from '@/lib/contract';
import { 
  connectWallet, 
  disconnectWallet, 
  isUserSignedIn, 
  getCurrentUserData, 
  getSTXBalance, 
  formatSTX,
  isConnected,
  getLocalStorage
} from '@/lib/stacks';
import { 
  Target, 
  Plus, 
  Wallet, 
  LogOut,
  TrendingUp,
  Award,
  AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

interface UserStats {
  tasksCreated: number;
  tasksCompleted: number;
  tasksFailed: number;
  totalStaked: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userAddress, setUserAddress] = useState<string>('');
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [userStats, setUserStats] = useState<UserStats>({ tasksCreated: 0, tasksCompleted: 0, tasksFailed: 0, totalStaked: 0 });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [contract] = useState(new BitBondContract());

  // Define loadUserData function first
  const loadUserData = useCallback(async (address: string) => {
    try {
      const [balanceResult, statsResult] = await Promise.all([
        getSTXBalance(address),
        contract.getUserStats(address)
      ]);
      
      setBalance(balanceResult);
      setUserStats(statsResult);
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load user data');
    }
  }, [contract]);

  // Check authentication on page load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        let address = '';
        
        if (isConnected()) {
          const data = getLocalStorage();
          if (data?.addresses?.stx?.[0]?.address) {
            address = data.addresses.stx[0].address;
          }
        } else if (isUserSignedIn()) {
          const userData = getCurrentUserData();
          if (userData && typeof userData === 'object' && 'profile' in userData && userData.profile?.stxAddress?.testnet) {
            address = userData.profile.stxAddress.testnet;
          }
        }

        if (!address) {
          // No wallet connected, redirect to landing page
          router.push('/');
          return;
        }

        setUserAddress(address);
        await loadUserData(address);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, loadUserData]);

  const handleDisconnect = () => {
    disconnectWallet();
    toast.success('Wallet disconnected');
    router.push('/');
  };

  const handleTaskCreated = () => {
    loadUserData(userAddress);
    toast.success('Task created successfully!');
  };

  const handleTaskUpdate = () => {
    loadUserData(userAddress);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#333',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-3 rounded-xl shadow-lg">
              <Target className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">BitBond Dashboard</h1>
              <p className="text-gray-600">Manage your accountability tasks</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Connected Wallet</p>
              <p className="font-mono text-sm font-semibold text-gray-900">
                {userAddress.substring(0, 8)}...{userAddress.substring(userAddress.length - 4)}
              </p>
              <p className="text-sm text-orange-600 font-semibold">
                {formatSTX(balance)} STX
              </p>
            </div>
            <Button
              onClick={handleDisconnect}
              variant="outline"
              size="sm"
              className="border-gray-300 hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Tasks Created</CardTitle>
                <Target className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-500">{userStats.tasksCreated}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Completed</CardTitle>
                <Award className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-500">{userStats.tasksCompleted}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Failed</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-500">{userStats.tasksFailed}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Total Staked</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-500">{formatSTX(BigInt(userStats.totalStaked))} STX</p>
            </CardContent>
          </Card>
        </div>

        {/* Create Task Button */}
        <div className="mb-8">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create New Task
          </Button>
        </div>

        {/* Task Tabs */}
        <TaskTabs 
          userAddress={userAddress} 
          onTaskUpdate={handleTaskUpdate}
        />

        {/* Create Task Modal */}
        <CreateTaskModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          userAddress={userAddress}
          onTaskCreated={handleTaskCreated}
        />
      </div>
    </div>
  );
}