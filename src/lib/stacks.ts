import { StacksTestnet, StacksMainnet } from '@stacks/network';

export const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK === 'mainnet' 
  ? new StacksMainnet() 
  : new StacksTestnet();

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