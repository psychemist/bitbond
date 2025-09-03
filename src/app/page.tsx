'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  connectWallet, 
  isUserSignedIn, 
  getCurrentUserData, 
  isConnected,
  getLocalStorage
} from '@/lib/stacks';
import { 
  Target, 
  Shield, 
  Users, 
  TrendingUp, 
  CheckCircle,
  Wallet
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if user is already authenticated on page load
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
          if (userData?.profile?.stxAddress?.testnet) {
            address = userData.profile.stxAddress.testnet;
          }
        }

        if (address) {
          // User is already authenticated, redirect to dashboard
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Auth check error:', error);
      }
    };

    checkAuth();
  }, [router]);

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      const userAddress = await connectWallet();
      if (userAddress) {
        // Successfully connected, redirect to dashboard
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-8">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 rounded-2xl shadow-2xl">
              <Target className="h-16 w-16 text-white" />
            </div>
          </div>
          
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            BitBond
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Accountability through blockchain. Stake STX on your goals, 
            get verified by trusted buddies, and achieve more than ever before.
          </p>

          <Button
            onClick={handleConnectWallet}
            disabled={isConnecting}
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isConnecting ? (
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Connecting Wallet...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Wallet className="h-6 w-6" />
                <span>Connect Wallet to Start</span>
              </div>
            )}
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300">
            <CardHeader>
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl text-primary-foreground">Blockchain Security</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-600 text-base">
                Your stakes and verifications are secured by the Stacks blockchain, 
                ensuring transparency and immutability.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300">
            <CardHeader>
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl text-primary-foreground">Accountability Buddies</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-600 text-base">
                Choose trusted friends or colleagues to verify your task completion 
                and keep you motivated.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300">
            <CardHeader>
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl text-primary-foreground">Real Stakes</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-600 text-base">
                Put your money where your mouth is. Stake STX tokens that you&lsquo;ll 
                lose if you don&lsquo;t complete your goals.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-12">How It Works</h2>
          
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Create Task', desc: 'Set your goal and stake STX tokens' },
              { step: '2', title: 'Choose Buddy', desc: 'Select someone to verify completion' },
              { step: '3', title: 'Complete Goal', desc: 'Work on your task before deadline' },
              { step: '4', title: 'Get Verified', desc: 'Buddy confirms completion, you get your stake back' }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Commit?</h2>
          <p className="text-xl text-orange-100 mb-8">
            Turn your goals into guaranteed results with blockchain accountability.
          </p>
          
          <Button
            onClick={handleConnectWallet}
            disabled={isConnecting}
            size="lg"
            className="bg-white text-orange-600 hover:bg-orange-50 font-bold text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isConnecting ? (
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Wallet className="h-6 w-6" />
                <span>Get Started Now</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}