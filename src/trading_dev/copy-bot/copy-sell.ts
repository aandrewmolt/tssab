import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { wallet, connection, smart_money_wallet } from "../../helpers/config";
import { sell } from "../../raydium/sell_helper";
import { checkTakeProfit, checkStopLoss } from "../ProfitAndLoss";
import { path_To_bought_tokens } from "../ProfitAndLoss/constants";
import { logger } from "../../helpers/logger";
import { checkTx } from "../../helpers/util";

var current_trader_wallet_state: any = {};
var current_our_wallet_state: any = {};
// [usdc, sol, usdt, wsol]
const wsol = "So11111111111111111111111111111111111111112";
const quoteToken = [
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "SOL",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  wsol,
];
const boughtTokensPath = path.join(__dirname, "bought-tokens.json");
let boughtTokens = JSON.parse(fs.readFileSync(boughtTokensPath, "utf8"));
function saveToJson() {
  fs.writeFileSync(boughtTokensPath, JSON.stringify(boughtTokens, null, 2));
}
/**
 * Retrieves the state of a wallet by querying the Solana blockchain.
 * @param {string} wallet_address - The address of the wallet to retrieve the state for.
 * @returns {Object} - An object containing the token balances of the wallet and the SOL balance.
 */
async function retriveWalletState(wallet_address: string) {
  const filters = [
    {
      dataSize: 165, //size of account (bytes)
    },
    {
      memcmp: {
        offset: 32, //location of our query in the account (bytes)
        bytes: wallet_address, //our search criteria, a base58 encoded string
      },
    },
  ];
  const accounts = await connection.getParsedProgramAccounts(
    TOKEN_PROGRAM_ID, //new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    { filters: filters }
  );
  let results: any = {};
  const solBalance = await connection.getBalance(new PublicKey(wallet_address));
  accounts.forEach((account, i) => {
    //Parse the account data
    const parsedAccountInfo: any = account.account.data;
    const mintAddress = parsedAccountInfo["parsed"]["info"]["mint"];
    const tokenBalance =
      parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];

    results[mintAddress] = tokenBalance;
    results["SOL"] = solBalance / 10 ** 9;
  });
  return results;
}

async function logTransactionSuccess(txid: string, tokenAddress: string, type: 'buy' | 'sell') {
    const elapsed = process.hrtime();
    const success = await checkTx(txid);
    const elapsedSeconds = process.hrtime(elapsed)[1] / 1e9;
    
    if (success) {
        logger.info(`Transaction Success. Elapsed time: ${elapsedSeconds.toFixed(3)} seconds.`);
        logger.info(`https://dexscreener.com/solana/${tokenAddress}?maker=${wallet.publicKey.toString()}`);
        logger.info(`https://solscan.io/tx/${txid}?cluster=mainnet`);
    } else {
        logger.error(`Transaction failed after ${elapsedSeconds.toFixed(3)} seconds.`);
    }
}

const sellInProgress = new Set<string>();

export async function copy_sell(address: string) {
  let soldTokens: string[] = [];
  let flag = false;
  
  try {
    if (boughtTokens.length > 0) {
      for (let i = 0; i < boughtTokens.length; i++) {
        let token = boughtTokens[i];
        
        if (sellInProgress.has(token)) {
          continue;
        }

        current_trader_wallet_state = await retriveWalletState(address);
        
        if (
          !(token in current_trader_wallet_state) ||
          current_trader_wallet_state[token] == 0 ||
          await checkTakeProfit(token, path_To_bought_tokens) || 
          await checkStopLoss(token, path_To_bought_tokens)
        ) {
          try {
            sellInProgress.add(token);
            
            logger.info(`Selling ${token}...`);
            soldTokens.push(token);
            flag = true;
            
            const txid = await sell("sell", token, 100, wallet);
            await logTransactionSuccess(txid, token, 'sell');
          } catch (error) {
            logger.error(`Error selling ${token}: ${error}`);
          } finally {
            sellInProgress.delete(token);
          }
        }
      }
    }
  } catch (err) {
    logger.error(`Error in copy_sell: ${err}`);
  }

  if (flag) {
    boughtTokens = boughtTokens.filter(
      (token: any) => !soldTokens.includes(token)
    );
    saveToJson();
  }
}

const LOCK_FILE = path.join(__dirname, 'copy-sell.lock');
const LOCK_STALE_MS = 30000; // Consider lock stale after 30 seconds

function acquireLock(): boolean {
  try {
    // Check if lock file exists and isn't stale
    if (fs.existsSync(LOCK_FILE)) {
      const lockStats = fs.statSync(LOCK_FILE);
      const lockAge = Date.now() - lockStats.mtimeMs;
      
      if (lockAge < LOCK_STALE_MS) {
        return false; // Lock exists and is fresh
      }
      // Lock is stale, we can override it
    }
    
    // Create or update lock file
    fs.writeFileSync(LOCK_FILE, Date.now().toString());
    return true;
  } catch (error) {
    logger.error(`Error acquiring lock: ${error}`);
    return false;
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (error) {
    logger.error(`Error releasing lock: ${error}`);
  }
}

// Update the main function
async function main() {
  if (!acquireLock()) {
    logger.info("Another instance is already running");
    return;
  }

  try {
    while (true) {
      try {
        // Update lock file timestamp to show we're still alive
        fs.writeFileSync(LOCK_FILE, Date.now().toString());
        
        boughtTokens = JSON.parse(fs.readFileSync(boughtTokensPath, "utf8"));
        await copy_sell(smart_money_wallet || "");
      } catch (error) {
        logger.error(`Error in main loop: ${error}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } finally {
    releaseLock();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  releaseLock();
  process.exit(0);
});

process.on('SIGTERM', () => {
  releaseLock();
  process.exit(0);
});

// Start the main loop
main().catch(error => {
  logger.error("Fatal error in main loop:", error);
  releaseLock();
});
