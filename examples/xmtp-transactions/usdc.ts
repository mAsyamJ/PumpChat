import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import { createPublicClient, formatUnits, http, toHex } from "viem";
import { base, baseSepolia } from "viem/chains";

// Network configuration type
export type NetworkConfig = {
  tokenAddress: string;
  chainId: `0x${string}`;
  decimals: number;
  networkName: string;
  networkId: string;
};

// Available network configurations
export const USDC_NETWORKS: NetworkConfig[] = [
  {
    tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    chainId: toHex(84532),
    decimals: 6,
    networkName: "Base Sepolia",
    networkId: "base-sepolia",
  },
  {
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base Mainnet
    chainId: toHex(8453),
    decimals: 6,
    networkName: "Base Mainnet",
    networkId: "base-mainnet",
  },
  {
    tokenAddress: "0x82653402f5e59968993177BF1BC1029A1802dac8", // Replace with your Sepolia USDC token
    chainId: toHex(11155111), // Sepolia chain ID in hex
    decimals: 6,
    networkName: "Ethereum Sepolia",
    networkId: "eth-sepolia",
  },
];

// ERC20 minimal ABI for balance checking
const erc20Abi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export class USDCHandler {
  private networkConfig: NetworkConfig;
  private publicClient;

  constructor(networkId: string) {
    const config = USDC_NETWORKS.find(
      (network) => network.networkId === networkId,
    );
    if (!config) {
      throw new Error(`Network configuration not found for: ${networkId}`);
    }

    this.networkConfig = config;

    this.publicClient = createPublicClient({
      chain:
        networkId === "base-mainnet"
          ? base
          : networkId === "base-sepolia"
          ? baseSepolia
          : {
              id: 11155111,
              name: "Ethereum Sepolia",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: {
                default: {
                  http: ["https://ethereum-sepolia.publicnode.com"],
                },
              },
              blockExplorers: {
                default: {
                  name: "Etherscan",
                  url: "https://sepolia.etherscan.io",
                },
              },
            },
      transport: http(),
    });
  }

  async getUSDCBalance(address: string): Promise<string> {
    const balance = await this.publicClient.readContract({
      address: this.networkConfig.tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });

    return formatUnits(balance, this.networkConfig.decimals);
  }

  createUSDCTransferCalls(
    fromAddress: string,
    recipientAddress: string,
    amount: number,
  ): WalletSendCallsParams {
    const methodSignature = "0xa9059cbb"; // ERC20 transfer(address,uint256)

    const transactionData = `${methodSignature}${recipientAddress
      .slice(2)
      .padStart(64, "0")}${BigInt(amount).toString(16).padStart(64, "0")}`;

    return {
      version: "1.0",
      from: fromAddress as `0x${string}`,
      chainId: this.networkConfig.chainId,
      calls: [
        {
          to: this.networkConfig.tokenAddress as `0x${string}`,
          data: transactionData as `0x${string}`,
          metadata: {
            description: `Transfer ${amount / Math.pow(10, this.networkConfig.decimals)} USDC on ${this.networkConfig.networkName}`,
            transactionType: "transfer",
            currency: "USDC",
            amount: amount,
            decimals: this.networkConfig.decimals,
            networkId: this.networkConfig.networkId,
          },
        },
      ],
    };
  }
}
