import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import { callReadOnlyFunction, cvToJSON } from '@stacks/transactions';

// Network configuration
export const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK === 'mainnet' 
  ? STACKS_MAINNET 
  : STACKS_TESTNET;

export const STACKS_API_URL = process.env.NEXT_PUBLIC_STACKS_API_URL || 'https://api.testnet.hiro.so';

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
export const CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME || 'bitbond-escrow';

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Wallet configuration
export const WALLET_CONFIG = {
  appDetails: {
    name: 'BitBond',
    icon: `${APP_URL}/logo.png`,
  },
  userSession: null,
};

// Supported wallets
export const SUPPORTED_WALLETS = [
  'xverse',
  'leather',
] as const;

export type SupportedWallet = typeof SUPPORTED_WALLETS[number];

const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

export async function connectWallet(): Promise<string> {
  return new Promise((resolve, reject) => {
    showConnect({
      appDetails: {
        name: 'BitBond',
        icon: '/favicon.ico',
      },
      redirectTo: '/',
      onFinish: () => {
        const userData = userSession.loadUserData();
        resolve(userData.profile.stxAddress.testnet);
      },
      onCancel: () => {
        reject(new Error('User cancelled wallet connection'));
      },
      userSession,
    });
  });
}

export async function getSTXBalance(address: string): Promise<bigint> {
  // Mock balance for demo - in production would fetch from Stacks API
  return 100000000000000n; // 100,000 STX in microSTX
}

export function formatSTX(microSTX: bigint): string {
  const stx = Number(microSTX) / 1000000;
  return stx.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 6 
  });
}