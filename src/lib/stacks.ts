import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

// Network configuration
export const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK === 'mainnet' 
  ? STACKS_MAINNET 
  : STACKS_TESTNET;

export const STACKS_API_URL = process.env.NEXT_PUBLIC_STACKS_API_URL || 'https://api.testnet.hiro.so';

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
export const CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME || 'bitbond-escrow';

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// App configuration for Stacks authentication
const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

// App details for wallet connection
export const appDetails = {
  name: 'BitBond',
  icon: `${APP_URL}/favicon.ico`,
};

// Supported wallets - prioritize Leather (Hiro) over others
export const SUPPORTED_WALLETS = [
  'leather',  // Hiro Wallet (renamed to Leather)
  'hiro',     // Legacy name
  'xverse',
] as const;

export type SupportedWallet = typeof SUPPORTED_WALLETS[number];

export async function connectWallet(): Promise<string> {
  console.log('Attempting to connect wallet...');
  console.log('Detected wallets:', getAvailableWallets());
  
  return new Promise((resolve, reject) => {
    showConnect({
      appDetails,
      onFinish: () => {
        console.log('Wallet connection finished, handling pending sign in...');
        // Handle the pending sign in after wallet connection
        if (userSession.isSignInPending()) {
          userSession.handlePendingSignIn().then((userData) => {
            console.log('Sign in completed with Leather wallet:', userData);
            const address = userData.profile.stxAddress.testnet;
            console.log('Testnet address:', address);
            resolve(address);
          }).catch((error) => {
            console.error('Error handling pending sign in:', error);
            reject(error);
          });
        } else {
          // User might already be signed in
          const userData = userSession.loadUserData();
          const address = userData.profile.stxAddress.testnet;
          console.log('User already signed in with Leather, address:', address);
          resolve(address);
        }
      },
      onCancel: () => {
        console.log('Wallet connection cancelled');
        reject(new Error('User cancelled wallet connection'));
      },
      userSession,
    });
  });
}

// Detect available wallet providers
export function getAvailableWallets(): string[] {
  if (typeof window === 'undefined') return [];
  
  const wallets: string[] = [];
  
  // Check for Leather (Hiro) wallet
  if ((window as any).LeatherProvider || (window as any).HiroWalletProvider) {
    wallets.push('leather');
  }
  
  // Check for Xverse
  if ((window as any).StacksProvider || (window as any).XverseProviders) {
    wallets.push('xverse');
  }
  
  return wallets;
}

// Check if user is already authenticated
export function isUserSignedIn(): boolean {
  return userSession.isUserSignedIn();
}

// Get current user data if signed in
export function getCurrentUserData() {
  if (userSession.isUserSignedIn()) {
    return userSession.loadUserData();
  }
  return null;
}

// Sign out user
export function signOut() {
  console.log('Signing out user and clearing all authentication data...');
  userSession.signUserOut();
  
  // Clear any additional browser storage that might persist wallet state
  if (typeof window !== 'undefined') {
    // Clear localStorage items that might store wallet state
    localStorage.removeItem('blockstack-session');
    localStorage.removeItem('blockstack-transit-private-key');
    localStorage.removeItem('stacks-wallet-state');
    localStorage.removeItem('connect-wallet-state');
    
    // Clear sessionStorage as well
    sessionStorage.clear();
    
    console.log('Cleared browser storage, reloading page...');
  }
  
  // Force reload to ensure clean state
  window.location.reload();
}

export async function getSTXBalance(address: string): Promise<bigint> {
  try {
    const response = await fetch(`${STACKS_API_URL}/extended/v1/address/${address}/balances`);
    
    if (!response.ok) {
      console.error('Failed to fetch STX balance:', response.status, response.statusText);
      return BigInt(0);
    }

    const data = await response.json();
    
    // STX balance is in microSTX
    const stxBalance = BigInt(data.stx.balance || '0');
    return stxBalance;
  } catch (error) {
    console.error('Error fetching STX balance:', error);
    // Fallback to demo balance for development
    return BigInt(100000000); // 100 STX in microSTX
  }
}

export function formatSTX(microSTX: bigint): string {
  const stx = Number(microSTX) / 1000000;
  return stx.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 6 
  });
}