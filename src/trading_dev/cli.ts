import { Command } from 'commander';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { wallet, connection } from '../helpers/config';
import { sell } from '../raydium/sell_helper';
import { retriveWalletState } from './ProfitAndLoss/utils';
import { logger } from '../helpers/logger';
import { fork, ChildProcess } from 'child_process';
import path from 'path';
import inquirer from 'inquirer';
import { getCurrentPriceInSOL, getCurrentPriceInUSD } from '../raydium/fetch-price';
import { wsol, path_To_bought_tokens } from './ProfitAndLoss/constants';
import { getCurrentPriceRaydium } from './ProfitAndLoss/utils';

const program = new Command();

// Create a simple table without external dependency
function createTable(headers: string[], rows: string[][]): string {
    const columnWidths = headers.map(header => 
        Math.max(
            header.length,
            ...rows.map(row => row[headers.indexOf(header)]?.length || 0)
        )
    );

    const separator = '+' + columnWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
    
    const headerRow = '|' + headers.map((h, i) => 
        ` ${h.padEnd(columnWidths[i])} `
    ).join('|') + '|';

    const dataRows = rows.map(row => 
        '|' + row.map((cell, i) => 
            ` ${(cell || '').padEnd(columnWidths[i])} `
        ).join('|') + '|'
    );

    return [
        separator,
        headerRow,
        separator,
        ...dataRows,
        separator
    ].join('\n');
}

// Start copy trading function
async function startCopyTrading(): Promise<ChildProcess> {
    const copyTradePath = path.join(__dirname, 'copy-bot/copy-trade.ts');
    const copyTradeProcess = fork(copyTradePath);

    copyTradeProcess.on('exit', (code) => {
        logger.info(`Copy trading exited with code: ${code}`);
    });

    return copyTradeProcess;
}

function formatNumber(num: number, decimals: number = 8): string {
    if (num < 0.00000001) return num.toExponential(2);
    return num.toFixed(decimals);
}

function formatUSD(num: number): string {
    if (num < 0.01) return num.toExponential(2);
    return num.toFixed(2);
}

// Add list of tokens to skip price checks for
const SKIP_PRICE_CHECK_TOKENS = [
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP token
    wsol // Wrapped SOL
];

// Portfolio management functions
async function displayPortfolio() {
    const walletState = await retriveWalletState(wallet.publicKey.toString());
    const rows: string[][] = [];

    for (const [token, balance] of Object.entries(walletState)) {
        if (token === 'SOL') continue;
        if (Number(balance) > 0) {
            try {
                let priceInSol = 'N/A';
                let priceInUSD = 'N/A';
                let valueInUSD = 0;

                // Special handling for WSOL and skip-list tokens
                if (SKIP_PRICE_CHECK_TOKENS.includes(token)) {
                    if (token === wsol) {
                        priceInSol = '1.00000000';
                        priceInUSD = '150.00';
                        valueInUSD = Number(balance) * 150;
                    }
                } else {
                    try {
                        const price = await getCurrentPriceRaydium(token, path_To_bought_tokens);
                        if (price) {
                            priceInSol = formatNumber(Number(price));
                            const usdPrice = Number(price) * 150;
                            priceInUSD = formatUSD(usdPrice);
                            valueInUSD = Number(balance) * usdPrice;
                        }
                    } catch (error) {
                        logger.error(`Error fetching price for ${token}: ${error}`);
                    }
                }
                
                rows.push([
                    token.slice(0, 8) + '...',
                    formatNumber(Number(balance), 6),
                    priceInSol,
                    priceInUSD,
                    formatUSD(valueInUSD)
                ]);
            } catch (error) {
                logger.error(`Error processing token ${token}: ${error}`);
                rows.push([
                    token.slice(0, 8) + '...',
                    formatNumber(Number(balance), 6),
                    'Error',
                    'Error',
                    '0.00'
                ]);
            }
        }
    }

    console.log('\nYour Portfolio:');
    console.log(createTable(
        ['Token', 'Balance', 'Price (SOL)', 'Price (USD)', 'Value (USD)'],
        rows
    ));
    
    return walletState;
}

async function sellTokens(percentage: number, specificToken?: string) {
    const walletState = await retriveWalletState(wallet.publicKey.toString());
    let successCount = 0;
    let failCount = 0;
    
    async function attemptSell(token: string, balance: number) {
        if (token === 'SOL' || balance <= 0 || token === wsol) return;
        
        try {
            logger.info(`Attempting to sell ${balance} of ${token}...`);
            const txid = await sell("sell", token, percentage, wallet);
            if (txid) {
                logger.info(`Successfully sold ${token}. Transaction: ${txid}`);
                logger.info(`https://solscan.io/tx/${txid}?cluster=mainnet`);
                successCount++;
            } else {
                logger.error(`Failed to sell ${token}`);
                failCount++;
            }
        } catch (error: any) {
            logger.error(`Error selling ${token}: ${error?.message || 'Unknown error'}`);
            failCount++;
        }
        
        // Add delay between sells to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (specificToken) {
        if (walletState[specificToken]) {
            await attemptSell(specificToken, Number(walletState[specificToken]));
        } else {
            logger.error(`Token ${specificToken} not found in wallet`);
        }
    } else {
        // Sort tokens by value (highest first) and filter out problematic tokens
        const tokens = Object.entries(walletState)
            .filter(([token, balance]) => 
                token !== 'SOL' && 
                Number(balance) > 0 &&
                token !== wsol && // Skip wrapped SOL
                token !== 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' // Skip JUP token
            );
        
        // Sell tokens sequentially
        for (const [token, balance] of tokens) {
            await attemptSell(token, Number(balance));
        }
    }

    // Show summary
    if (!specificToken) {
        logger.info('\nSell Operations Summary:');
        logger.info(`Successfully sold: ${successCount} tokens`);
        logger.info(`Failed to sell: ${failCount} tokens`);
    }
}

async function interactivePortfolioManagement() {
    const walletState = await displayPortfolio();
    
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                'Sell percentage of all tokens',
                'Sell specific token',
                'Back to main menu',
            ]
        }
    ]);

    if (action === 'Sell percentage of all tokens') {
        const { percentage } = await inquirer.prompt([
            {
                type: 'list',
                name: 'percentage',
                message: 'What percentage would you like to sell?',
                choices: ['25', '50', '75', '100']
            }
        ]);
        
        logger.info(`Selling ${percentage}% of all tokens...`);
        await sellTokens(Number(percentage));
        logger.info('Sell operations completed');
        
    } else if (action === 'Sell specific token') {
        const tokens = Object.entries(walletState)
            .filter(([token, balance]) => token !== 'SOL' && Number(balance) > 0)
            .map(([token]) => ({
                name: `${token.slice(0, 8)}... (Balance: ${walletState[token]})`,
                value: token
            }));

        const { token, percentage } = await inquirer.prompt([
            {
                type: 'list',
                name: 'token',
                message: 'Which token would you like to sell?',
                choices: tokens
            },
            {
                type: 'list',
                name: 'percentage',
                message: 'What percentage would you like to sell?',
                choices: ['25', '50', '75', '100']
            }
        ]);
        
        logger.info(`Selling ${percentage}% of ${token}...`);
        await sellTokens(Number(percentage), token);
        logger.info('Sell operation completed');
    }
    
    // Show updated portfolio
    await displayPortfolio();
}

// Add this new command handler
async function sendTestTransaction(tokenAddress: string) {
  try {
    const targetWallet = new PublicKey("7zKc3HbTUhAv5mPYfY6qAAooazjYV2N74dQyYzQ8ghNW"); // Wallet we're monitoring
    const amount = 0.00001; // SOL amount to send
    
    logger.info("=== Test Transaction Details ===");
    logger.info(`From: ${wallet.publicKey.toString()}`);
    logger.info(`To: ${targetWallet.toString()}`);
    logger.info(`Amount: ${amount} SOL`);
    logger.info(`Token: ${tokenAddress}`);

    // Get current balance
    const balance = await connection.getBalance(wallet.publicKey);
    logger.info(`Current wallet balance: ${balance / 1e9} SOL`);

    if (balance < amount * 1e9) {
      logger.error("Insufficient balance for test transaction");
      return;
    }

    // Create and send transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: targetWallet,
        lamports: amount * 1e9,
      })
    );

    // Use lower priority fees
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign and send
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    logger.info(`Transaction sent: https://solscan.io/tx/${signature}`);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });

    if (confirmation.value.err) {
      logger.error("Transaction failed:", confirmation.value.err);
    } else {
      logger.info("Transaction confirmed successfully!");
    }

  } catch (error) {
    logger.error("Error sending test transaction:", error);
  }
}

// Add this to your existing command menu
const commands = {
  // ... your existing commands ...
  "send-test": async () => {
    const tokenAddress = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"; // Your specified token
    await sendTestTransaction(tokenAddress);
  },
};

// Update your help menu
function showHelp() {
  console.log(`
Available commands:
  ... your existing commands ...
  send-test     - Send a small test transaction to the monitored wallet
  `);
}

// CLI Setup
program
    .version('1.0.0')
    .description('Solana Trading CLI');

program
    .command('copy-trade')
    .description('Start copy trading')
    .action(async () => {
        logger.info('Starting copy trading...');
        const copyTradeProcess = await startCopyTrading();
        
        // Handle Ctrl+C
        process.on('SIGINT', () => {
            copyTradeProcess.kill();
            logger.info('Copy trading stopped');
            process.exit(0);
        });
    });

program
    .command('portfolio')
    .description('Manage your portfolio')
    .action(async () => {
        while (true) {
            const { action } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'What would you like to do?',
                    choices: [
                        'View Portfolio',
                        'Manage Tokens',
                        'Exit'
                    ]
                }
            ]);

            if (action === 'View Portfolio') {
                await displayPortfolio();
            } else if (action === 'Manage Tokens') {
                await interactivePortfolioManagement();
            } else {
                process.exit(0);
            }
        }
    });

program
    .command('send-test')
    .description('Send a test transaction to the monitored wallet')
    .action(async () => {
        const tokenAddress = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
        await sendTestTransaction(tokenAddress);
        process.exit(0); // Exit after sending the test transaction
    });

program.parse(process.argv); 