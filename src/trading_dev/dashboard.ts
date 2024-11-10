import { Command } from 'commander';
import inquirer from 'inquirer';
import { logger } from '../helpers/logger';
import { wallet, connection } from '../helpers/config';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { fork, ChildProcess } from 'child_process';
import path from 'path';
import { displayPortfolio, interactivePortfolioManagement } from './ProfitAndLoss/portfolio';

let copyTradingProcess: ChildProcess | null = null;

async function sendTestTransaction(tokenAddress: string) {
    try {
        const targetWallet = new PublicKey("7zKc3HbTUhAv5mPYfY6qAAooazjYV2N74dQyYzQ8ghNW");
        const amount = 0.00001;

        logger.info("=== Test Transaction Details ===");
        logger.info(`From: ${wallet.publicKey.toString()}`);
        logger.info(`To: ${targetWallet.toString()}`);
        logger.info(`Amount: ${amount} SOL`);
        logger.info(`Token: ${tokenAddress}`);

        const balance = await connection.getBalance(wallet.publicKey);
        logger.info(`Current wallet balance: ${balance / 1e9} SOL`);

        if (balance < amount * 1e9) {
            logger.error("Insufficient balance for test transaction");
            return;
        }

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: targetWallet,
                lamports: amount * 1e9,
            })
        );

        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = wallet.publicKey;

        transaction.sign(wallet);
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
        });

        logger.info(`Transaction sent: https://solscan.io/tx/${signature}`);
        
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

async function startCopyTrading() {
    if (copyTradingProcess) {
        logger.info("Copy trading is already running!");
        return;
    }

    const copyTradePath = path.join(__dirname, 'copy-bot/copy-trade.ts');
    copyTradingProcess = fork(copyTradePath);

    copyTradingProcess.on('exit', (code) => {
        logger.info(`Copy trading exited with code: ${code}`);
        copyTradingProcess = null;
    });

    logger.info("Copy trading started successfully!");
}

async function stopCopyTrading() {
    if (!copyTradingProcess) {
        logger.info("Copy trading is not running!");
        return;
    }

    copyTradingProcess.kill();
    copyTradingProcess = null;
    logger.info("Copy trading stopped successfully!");
}

async function showDashboard() {
    while (true) {
        console.clear(); // Clear console for better visibility
        
        // Show current status
        console.log("\n=== Solana Trading Dashboard ===");
        console.log(`Connected Wallet: ${wallet.publicKey.toString()}`);
        console.log(`Copy Trading Status: ${copyTradingProcess ? '🟢 Running' : '🔴 Stopped'}`);
        console.log("===============================\n");

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Choose an action:',
                choices: [
                    'View Portfolio',
                    'Manage Tokens',
                    new inquirer.Separator(),
                    copyTradingProcess ? 'Stop Copy Trading' : 'Start Copy Trading',
                    'Send Test Transaction',
                    new inquirer.Separator(),
                    'Exit'
                ]
            }
        ]);

        switch (action) {
            case 'View Portfolio':
                await displayPortfolio();
                await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
                break;

            case 'Manage Tokens':
                await interactivePortfolioManagement();
                break;

            case 'Start Copy Trading':
                await startCopyTrading();
                await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
                break;

            case 'Stop Copy Trading':
                await stopCopyTrading();
                await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
                break;

            case 'Send Test Transaction':
                const tokenAddress = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
                await sendTestTransaction(tokenAddress);
                await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
                break;

            case 'Exit':
                if (copyTradingProcess) {
                    await stopCopyTrading();
                }
                process.exit(0);
        }
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    if (copyTradingProcess) {
        await stopCopyTrading();
    }
    process.exit(0);
});

// Start the dashboard
console.log("Starting Solana Trading Dashboard...");
showDashboard().catch(error => {
    logger.error("Fatal error in dashboard:", error);
    process.exit(1);
}); 