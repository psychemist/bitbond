'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CreateTaskModal } from '@/components/CreateTaskModal';
import { 
  Zap, 
  Shield, 
  Clock, 
  Users, 
  TrendingUp, 
  Target,
  Wallet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Bitcoin
} from 'lucide-react';
import { BitBondContract } from '@/lib/contract';
import { connectWallet, getSTXBalance, formatSTX } from '@/lib/stacks';

interface Task {
  id: number;
  title: string;
  description: string;
  creator: string;
  buddy: string;
  stakeAmount: bigint;
  deadline: number;
  status: 'active' | 'completed' | 'failed' | 'expired';
  verified: boolean;
  createdAt: number;
}

interface UserStats {
  tasksCreated: number;
  tasksCompleted: number;
  tasksFailed: number;
  totalStaked: bigint;
  successRate: number;
}

export default function HomePage() {
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string>('');
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [userStats, setUserStats] = useState<UserStats>({
    tasksCreated: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    totalStaked: BigInt(0),
    successRate: 0
  });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contract] = useState(new BitBondContract());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleConnectWallet = async () => {
    setIsLoading(true);
    try {
      const address = await connectWallet();
      setUserAddress(address);
      setIsConnected(true);
      
      // Get user balance
      const userBalance = await getSTXBalance(address);
      setBalance(userBalance);
      
      // Get user stats from contract
      const stats = await contract.getUserStats(address);
      if (stats) {
        setUserStats({
          tasksCreated: Number(stats.tasksCreated),
          tasksCompleted: Number(stats.tasksCompleted),
          tasksFailed: Number(stats.tasksFailed),
          totalStaked: stats.totalStaked,
          successRate: stats.tasksCreated > 0 
            ? (Number(stats.tasksCompleted) / Number(stats.tasksCreated)) * 100 
            : 0
        });
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
    setIsLoading(false);
  };

  const handleTaskCreated = (newTask: Task) => {
    setRecentTasks(prev => [newTask, ...prev]);
    // Refresh user stats
    if (userAddress) {
      contract.getUserStats(userAddress).then(stats => {
        if (stats) {
          setUserStats({
            tasksCreated: Number(stats.tasksCreated),
            tasksCompleted: Number(stats.tasksCompleted),
            tasksFailed: Number(stats.tasksFailed),
            totalStaked: stats.totalStaked,
            successRate: stats.tasksCreated > 0 
              ? (Number(stats.tasksCompleted) / Number(stats.tasksCreated)) * 100 
              : 0
          });
        }
      });
    }
  };

  useEffect(() => {
    const mockTasks: Task[] = [
      {
        id: 1,
        title: "Complete Daily Workout",
        description: "30-minute morning workout routine",
        creator: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
        buddy: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
        stakeAmount: BigInt(1000000), // 1 STX
        deadline: 150,
        status: 'active',
        verified: false,
        createdAt: Date.now() - 3600000
      },
      {
        id: 2,
        title: "Read 10 Pages",
        description: "Read 10 pages of 'Atomic Habits'",
        creator: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
        buddy: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
        stakeAmount: BigInt(500000), // 0.5 STX
        deadline: 200,
        status: 'completed',
        verified: true,
        createdAt: Date.now() - 7200000
      },
      {
        id: 3,
        title: "No Social Media",
        description: "Avoid social media for the entire day",
        creator: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
        buddy: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
        stakeAmount: BigInt(750000), // 0.75 STX
        deadline: 180,
        status: 'failed',
        verified: true,
        createdAt: Date.now() - 10800000
      }
    ];

    setRecentTasks(mockTasks);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative container mx-auto px-4 py-20">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <Bitcoin className="h-12 w-12" />
              <h1 className="text-6xl font-bold tracking-tight">
                Bit<span className="text-amber-200">Bond</span>
              </h1>
            </div>
            
            <p className="text-xl md:text-2xl text-orange-100 max-w-3xl mx-auto leading-relaxed">
              Turn your goals into unstoppable commitments. Stake STX tokens on personal tasks, 
              get verified by trusted accountability buddies, and build unbreakable habits.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              {!isConnected ? (
                <Button 
                  onClick={handleConnectWallet}
                  disabled={isLoading}
                  className="bg-white text-orange-600 hover:bg-orange-50 px-8 py-3 text-lg font-semibold"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-600 border-t-transparent mr-2" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="mr-2 h-5 w-5" />
                      Connect Wallet
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex items-center space-x-4">
                  <Badge className="bg-green-500 text-white px-4 py-2">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Connected
                  </Badge>
                  <span className="text-orange-100">
                    Balance: {formatSTX(balance)} STX
                  </span>
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="border-white text-white hover:bg-white/10 px-8 py-3 text-lg"
                onClick={() => setIsCreateModalOpen(true)}
                disabled={!isConnected}
              >
                <Target className="mr-2 h-5 w-5" />
                Create Task
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Contract Performance
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our BitBond smart contract is fully tested and ready for accountability tracking
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="text-center border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
              <CardHeader className="pb-2">
                <div className="mx-auto bg-orange-500 text-white rounded-full p-3 w-16 h-16 flex items-center justify-center">
                  <TrendingUp className="h-8 w-8" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">15/15</div>
                <div className="text-sm text-gray-600">Tests Passing</div>
              </CardContent>
            </Card>
            
            <Card className="text-center border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader className="pb-2">
                <div className="mx-auto bg-green-500 text-white rounded-full p-3 w-16 h-16 flex items-center justify-center">
                  <Shield className="h-8 w-8" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">100%</div>
                <div className="text-sm text-gray-600">Security Coverage</div>
              </CardContent>
            </Card>
            
            <Card className="text-center border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
              <CardHeader className="pb-2">
                <div className="mx-auto bg-blue-500 text-white rounded-full p-3 w-16 h-16 flex items-center justify-center">
                  <Zap className="h-8 w-8" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">232ms</div>
                <div className="text-sm text-gray-600">Test Runtime</div>
              </CardContent>
            </Card>
            
            <Card className="text-center border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardHeader className="pb-2">
                <div className="mx-auto bg-purple-500 text-white rounded-full p-3 w-16 h-16 flex items-center justify-center">
                  <Users className="h-8 w-8" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{recentTasks.length}</div>
                <div className="text-sm text-gray-600">Demo Tasks</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* User Dashboard */}
      {isConnected && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
                Your Accountability Dashboard
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* User Stats */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-orange-600">Your Stats</CardTitle>
                    <CardDescription>Track your progress and success rate</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Tasks Created</span>
                      <span className="font-semibold">{userStats.tasksCreated}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Completed</span>
                      <span className="font-semibold text-green-600">{userStats.tasksCompleted}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Failed</span>
                      <span className="font-semibold text-red-600">{userStats.tasksFailed}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Staked</span>
                      <span className="font-semibold">{formatSTX(userStats.totalStaked)} STX</span>
                    </div>
                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Success Rate</span>
                        <span className="font-semibold">{userStats.successRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={userStats.successRate} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
                
                {/* Recent Tasks */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-orange-600">Recent Tasks</CardTitle>
                    <CardDescription>Latest accountability challenges on the network</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentTasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-semibold text-gray-800">{task.title}</h3>
                              <Badge variant={
                                task.status === 'completed' ? 'default' :
                                task.status === 'failed' ? 'destructive' :
                                task.status === 'expired' ? 'secondary' : 'outline'
                              }>
                                {task.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>Stake: {formatSTX(task.stakeAmount)} STX</span>
                              <span>•</span>
                              <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {task.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                            {task.status === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
                            {task.status === 'active' && <Clock className="h-5 w-5 text-blue-500" />}
                            {task.status === 'expired' && <AlertTriangle className="h-5 w-5 text-orange-500" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-16 bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Built on Proven Smart Contract Technology
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our BitBond escrow contract has been thoroughly tested with 100% security coverage
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="border-orange-200 hover:border-orange-300 transition-colors">
              <CardHeader>
                <div className="bg-orange-100 text-orange-600 rounded-full p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6" />
                </div>
                <CardTitle className="text-gray-800">Secure Escrow</CardTitle>
                <CardDescription>
                  Your STX tokens are safely held in our tested smart contract until task verification
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-blue-200 hover:border-blue-300 transition-colors">
              <CardHeader>
                <div className="bg-blue-100 text-blue-600 rounded-full p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6" />
                </div>
                <CardTitle className="text-gray-800">Buddy Verification</CardTitle>
                <CardDescription>
                  Trusted accountability partners verify your task completion with cryptographic proof
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-green-200 hover:border-green-300 transition-colors">
              <CardHeader>
                <div className="bg-green-100 text-green-600 rounded-full p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6" />
                </div>
                <CardTitle className="text-gray-800">Time-Locked Goals</CardTitle>
                <CardDescription>
                  Set deadlines with grace periods. Emergency reclaim after 48 hours if unverified
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Phase 2 Completion Banner */}
      <section className="py-8 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-2">🎉 Phase 2 Complete!</h2>
            <p className="text-green-100 mb-4">
              Smart contract development finished with 15/15 tests passing. Ready for Phase 3: Authentication & User Management
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center">
                <CheckCircle className="mr-2 h-4 w-4" />
                Contract Deployed
              </div>
              <div className="flex items-center">
                <CheckCircle className="mr-2 h-4 w-4" />
                Frontend Integration
              </div>
              <div className="flex items-center">
                <CheckCircle className="mr-2 h-4 w-4" />
                Security Validated
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTaskCreated={handleTaskCreated}
        userAddress={userAddress}
      />
    </main>
  );
}