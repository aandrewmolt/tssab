import { deleteBoughtTokens, getSPLTokenBalance, loadBoughtTokens, logExitPrice, readBoughtTokens, writeBoughtTokens} from "./utils";
import {checkStopLoss } from "./stop-loss"
import { checkTakeProfit } from "./take-profit";
import {retriveWalletState, writeLineToLogFile} from "./utils";
import { logger } from "../../helpers/logger";
import {wsol, path_To_bought_tokens} from "./constants"
import {connection, wallet} from "../../helpers/config";
import { sell } from "../../raydium/sell_helper";
import Decimal from "decimal.js";
import { PublicKey } from "@solana/web3.js";
import fs from 'fs';

// Initialize bought_tokens.json if it doesn't exist
function initializeBoughtTokensFile() {
    if (!fs.existsSync(path_To_bought_tokens)) {
        fs.writeFileSync(path_To_bought_tokens, JSON.stringify({ tokens: [] }, null, 2));
        logger.info('Created new bought_tokens.json file');
    }
}

async function checkIsPricesHitTPorSL() {
    try {
        const boughtTokens = await loadBoughtTokens(path_To_bought_tokens) || [];
        
        if (boughtTokens && boughtTokens.length > 0) {
            for (let i = 0; i < boughtTokens.length; i++) {
                let token = boughtTokens[i];
                let tokenObj = await readBoughtTokens(token, path_To_bought_tokens);
                
                if (tokenObj && tokenObj.entry_price > 0) {
                    if (await checkTakeProfit(token, path_To_bought_tokens)) {
                        logger.info(`Take profit price reached for token ${token}`);
                        writeLineToLogFile(`Take profit price reached for token ${token}`);
                        const balance = await getSPLTokenBalance(connection, new PublicKey(token), wallet.publicKey);
                        
                        if (balance > 0) {
                            logger.info(`selling ${token}...`);
                            writeLineToLogFile(`selling ${token}...`);
                            await sell("sell", token, 100, wallet);
                        }
                        continue;
                    }
                    
                    if (await checkStopLoss(token, path_To_bought_tokens)) {
                        logger.info(`Stop loss price reached for token ${token}`);
                        writeLineToLogFile(`Stop loss price reached for token ${token}`);
                        const balance = await getSPLTokenBalance(connection, new PublicKey(token), wallet.publicKey);
                        
                        if (balance > 0) {
                            logger.info(`selling ${token}...`);
                            writeLineToLogFile(`selling ${token}...`);
                            await sell("sell", token, 100, wallet);
                        }
                    }
                }
            }
        }
    } catch (err) {
        logger.error(`Error in checkIsPricesHitTPorSL: ${err}`);
    }
}

export async function main() {
    logger.info("Starting sell checker...");
    initializeBoughtTokensFile(); // Initialize file if it doesn't exist
    
    while (true) {
        try {
            await checkIsPricesHitTPorSL();
        } catch (error) {
            logger.error(`Error in main loop: ${error}`);
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

main();