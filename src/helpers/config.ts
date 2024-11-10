import {
  Currency,
  Token,
  ENDPOINT,
  MAINNET_PROGRAM_ID,
  RAYDIUM_MAINNET,
  TxVersion,
  LOOKUP_TABLE_CACHE,
  TOKEN_PROGRAM_ID,
} from "@raydium-io/raydium-sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { logger } from "./logger";
import bs58 from "bs58";
import path from "path";

// Load environment variables from src/helpers/.env
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

// RPC endpoints
const RPC_ENDPOINT = "https://solana-api.instantnodes.io/token-hjjdHyNJgKSpoT3X6Otwqgfqaqabv9JY";
const WSS_ENDPOINT = "wss://solana-api.instantnodes.io/token-hjjdHyNJgKSpoT3X6Otwqgfqaqabv9JY";

// Connection setup with retry logic
function createConnectionWithRetry(): Connection {
    try {
        const connection = new Connection(RPC_ENDPOINT, {
            commitment: 'confirmed',
            wsEndpoint: WSS_ENDPOINT,
            confirmTransactionInitialTimeout: 60000
        });
        logger.info(`Connected to RPC: ${RPC_ENDPOINT}`);
        return connection;
    } catch (error) {
        logger.error(`Failed to connect to primary endpoint: ${error}`);
        // Fallback to public RPC if custom endpoint fails
        const fallbackConnection = new Connection("https://api.mainnet-beta.solana.com", {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 60000
        });
        logger.info("Using fallback RPC endpoint");
        return fallbackConnection;
    }
}

// Initialize wallet with proper error handling
function initializeWallet(): Keypair {
    const privateKeyString = process.env.PRIVATE_KEY;
    if (!privateKeyString) {
        throw new Error("PRIVATE_KEY not found in environment variables");
    }

    try {
        // Try base58 decode first
        return Keypair.fromSecretKey(bs58.decode(privateKeyString));
    } catch (error) {
        try {
            // Try comma-separated numbers
            const privateKeyArray = privateKeyString.split(',').map(Number);
            if (privateKeyArray.length !== 64) {
                throw new Error(`Invalid private key length: ${privateKeyArray.length} (expected 64)`);
            }
            return Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
        } catch (error) {
            logger.error(`Failed to initialize wallet: ${error}`);
            throw error;
        }
    }
}

// Export connection and constants
export const connection = createConnectionWithRetry();
export const wallet = initializeWallet();
export const jito_fee = process.env.JITO_FEE || "0.005";
export const shyft_api_key = process.env.SHYFT_API_KEY;
export const private_key = process.env.PRIVATE_KEY;
export const dev_endpoint = process.env.DEVNET_ENDPOINT || "";
export const main_endpoint = process.env.MAINNET_ENDPOINT || "";
export const bloXRoute_auth_header = process.env.BLOXROUTE_AUTH_HEADER;
export const bloXroute_fee = process.env.BLOXROUTE_FEE;
export const smart_money_wallet = process.env.SMART_MONEY_WALLET;
export const dev_connection = new Connection(dev_endpoint, "confirmed");

// Raydium constants
export const PROGRAMIDS = MAINNET_PROGRAM_ID;
export const RAYDIUM_MAINNET_API = RAYDIUM_MAINNET;
export const makeTxVersion = TxVersion.V0;
export const _ENDPOINT = ENDPOINT;
export const addLookupTableInfo = LOOKUP_TABLE_CACHE;

// Default tokens
export const DEFAULT_TOKEN = {
    SOL: new Currency(9, "SOL", "SOL"),
    WSOL: new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey("So11111111111111111111111111111111111111112"),
        9,
        'WSOL',
        'Wrapped SOL'
    ),
    USDC: new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        6,
        'USDC',
        'USDC'
    ),
};

export const wsol = "So11111111111111111111111111111111111111112";