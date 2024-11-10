import { fork } from 'child_process';
import path from 'path';
import { logger } from "../../helpers/logger";
import fs from 'fs';

const copySellPath = path.join(__dirname, '/copy-sell.ts');
const copyBuyPath = path.join(__dirname, '/copy-buy.ts');
const sellCheckerPath = path.join(__dirname, '../ProfitAndLoss/sell-checker.ts');
const sellCheckerLockPath = path.join(__dirname, '../ProfitAndLoss/.sell-checker.lock');

let sellCheckerProcess: any = null;

function startProcess(processPath: string, processName: string) {
    // For sell checker, check if it's already running
    if (processName === 'sell_checker') {
        if (fs.existsSync(sellCheckerLockPath)) {
            logger.info('Sell checker is already running');
            return null;
        }
    }

    const process = fork(processPath);
    
    process.on('exit', (code) => {
        logger.info(`${processName} process exited with code: ${code}`);
        if (code !== 0) {
            logger.warn(`${processName} crashed. Restarting...`);
            startProcess(processPath, processName);
        }
    });

    process.on('error', (error) => {
        logger.error(`${processName} error: ${error}`);
    });

    return process;
}

// Start copy processes
const copySellingProcess = startProcess(copySellPath, 'copy_sell');
const copyBuyingProcess = startProcess(copyBuyPath, 'copy_buy');

// Start sell checker only if not already running
if (!sellCheckerProcess) {
    sellCheckerProcess = startProcess(sellCheckerPath, 'sell_checker');
}

// Handle process termination
process.on('SIGINT', () => {
    logger.info('Shutting down all processes...');
    if (copySellingProcess) copySellingProcess.kill();
    if (copyBuyingProcess) copyBuyingProcess.kill();
    if (sellCheckerProcess) sellCheckerProcess.kill();
    
    // Clean up lock file
    try {
        if (fs.existsSync(sellCheckerLockPath)) {
            fs.unlinkSync(sellCheckerLockPath);
        }
    } catch (error) {
        logger.error('Error cleaning up lock file:', error);
    }
    
    process.exit(0);
});
  