import { AppConfig, UserSession, connect, disconnect, request, isConnected, getLocalStorage } from '@stacks/connect';
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network';

// Network configuration - using exported constants instead of classes
export const STACKS_API_URL = process.env.NEXT_PUBLIC_STACKS_API_URL || 'https://api.testnet.hiro.so';
const IS_MAINNET = process.env.NEXT_PUBLIC_STACKS_NETWORK === 'mainnet';

export const NETWORK = IS_MAINNET ? STACKS_MAINNET : STACKS_TESTNET;

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
export const CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME || 'bitbond-escrow-v2';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// App configuration
const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

export const appDetails = {
  name: 'BitBond',
  icon: `${APP_URL}/favicon.ico`,
};

// Connect wallet using the working pattern from reference
export const connectWallet = async (): Promise<string> => {
  console.log("=== Connect Wallet Debug ===");

  try {
    await connect();
    console.log("Wallet connected successfully");
    
    // Get user address after connection
    let userAddress = null;
    if (isConnected()) {
      const data = getLocalStorage();
      if (data?.addresses?.stx && data.addresses.stx.length > 0) {
        userAddress = data.addresses.stx[0].address;
      }
    } else if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      userAddress = userData.profile.stxAddress.testnet;
    }
    
    return userAddress || '';
  } catch (error) {
    console.error("Connection failed:", error);
    throw error;
  }
};

export const disconnectWallet = () => {
  disconnect();
  userSession.signUserOut("/");
};

// Helper function to call contracts using request method (more reliable than openContractCall)
async function callContractWithRequest(options: any) {
  try {
    const response = await request("stx_callContract", {
      contract: `${options.contractAddress}.${options.contractName}` as `${string}.${string}`,
      functionName: options.functionName,
      functionArgs: options.functionArgs,
      network: options.network?.chainId === 2147483648 ? "testnet" : "mainnet",
      postConditionMode: "allow",
      postConditions: [],
    });

    console.log("✅ Transaction submitted successfully:", response);
    if (options.onFinish) options.onFinish(response);
    return response;
  } catch (error) {
    console.error("❌ Contract call failed:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (options.onCancel) options.onCancel();
    throw error;
  }
}

// Detect available wallet providers
export function getAvailableWallets(): string[] {
  if (typeof window === 'undefined') return [];
  const wallets: string[] = [];
  if ((window as any).LeatherProvider || (window as any).HiroWalletProvider) wallets.push('leather');
  if ((window as any).StacksProvider || (window as any).XverseProviders) wallets.push('xverse');
  return wallets;
}

// Check if user is already authenticated
export function isUserSignedIn(): boolean { 
  return isConnected() || userSession.isUserSignedIn(); 
}

// Get current user data if signed in
export function getCurrentUserData() { 
  if (isConnected()) {
    const data = getLocalStorage();
    return data?.addresses?.stx?.[0]?.address;
  }
  return isUserSignedIn() ? userSession.loadUserData() : null; 
}

// Sign out user
export function signOut() {
  disconnectWallet();
}

// Get STX balance for a given address
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

// Format STX balance from microSTX to readable format
export function formatSTX(microSTX: bigint): string {
  const stx = Number(microSTX) / 1000000;
  return stx.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 6 
  });
}

// Helper function to get current block height for deadline calculations
export async function getCurrentBlockHeight(): Promise<number> {
  try {
    const res = await fetch(`${STACKS_API_URL}/v2/info`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    const height = data.stacks_tip_height || 0;
    return typeof height === 'number' ? height : parseInt(height, 10) || 0;
  } catch (error) {
    console.error('Failed to fetch current block height:', error);
    return 0;
  }
}

// Debug helpers
export function debugNetwork() {
  const n: any = NETWORK;
  console.log('[debugNetwork]', { coreApiUrl: n.coreApiUrl || n.coreApiUrlBase });
}

export function debugProviders() {
  if (typeof window === 'undefined') { console.log('No window (SSR)'); return; }
  console.log('[providers]', {
    LeatherProvider: !!(window as any).LeatherProvider,
    HiroWalletProvider: !!(window as any).HiroWalletProvider,
    StacksProvider: !!(window as any).StacksProvider,
    XverseProviders: !!(window as any).XverseProviders,
    AllProviders: Object.keys(window).filter((key) => key.toLowerCase().includes("provider"))
  });
}

// Export the contract calling function for use in contract.ts
export { callContractWithRequest, isConnected, getLocalStorage };