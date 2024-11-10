import { PublicKey } from '@solana/web3.js';
import { wallet, connection } from '../helpers/config';
import { logger } from '../helpers/logger';
import { wsol, path_To_bought_tokens } from './ProfitAndLoss/constants';
import { getCurrentPriceRaydium } from './ProfitAndLoss/utils';
import { sell } from '../raydium/sell_helper';
import inquirer from 'inquirer';

// Create a simple table without external dependency
function createTable(headers: string[], rows: string[][]): string {
    const columnWidths = headers.map(header => 
        Math.max(
            header.length,
            ...rows.map(row => row[headers.indexOf(header)]?.length || 0)
        )
    );

    const separator = '+' + columnWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
    const headerRow = '|' + headers.map((h, i) => ` ${h.padEnd(columnWidths[i])} `).join('|') + '|';
    const dataRows = rows.map(row => 
        '|' + row.map((cell, i) => ` ${(cell || '').padEnd(columnWidths[i])} `).join('|') + '|'
    );

    return [separator, headerRow, separator, ...dataRows, separator].join('\n');
}

function formatNumber(num: number, decimals: number = 8): string {
    if (num < 0.00000001) return num.toExponential(2);
    return num.toFixed(decimals);
}

function formatUSD(num: number): string {
    if (num < 0.01) return num.toExponential(2);
    return num.toFixed(2);
}

const SKIP_PRICE_CHECK_TOKENS = [
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    wsol
];

async function retriveWalletState(walletAddress: string) {
    const accounts = await connection.getParsedProgramAccounts(
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        {
            filters: [
                { dataSize: 165 },
                {
                    memcmp: {
                        offset: 32,
                        bytes: walletAddress,
                    },
                },
            ],
        }
    );

    const results: { [key: string]: number } = {};
    const solBalance = await connection.getBalance(new PublicKey(walletAddress));
    
    accounts.forEach((account: any) => {
        const parsedAccountInfo = account.account.data;
        const mintAddress = parsedAccountInfo["parsed"]["info"]["mint"];
        const tokenBalance = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
        results[mintAddress] = tokenBalance;
    });
    
    results["SOL"] = solBalance / 1e9;
    return results;
}

export async function displayPortfolio() {
    const walletState = await retriveWalletState(wallet.publicKey.toString());
    const rows: string[][] = [];

    for (const [token, balance] of Object.entries(walletState)) {
        if (token === 'SOL') continue;
        if (Number(balance) > 0) {
            try {
                let priceInSol = 'N/A';
                let priceInUSD = 'N/A';
                let valueInUSD = 0;

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

export async function interactivePortfolioManagement() {
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
        
        for (const [token, balance] of Object.entries(walletState)) {
            if (token !== 'SOL' && Number(balance) > 0 && token !== wsol) {
                try {
                    const txid = await sell("sell", token, Number(percentage), wallet);
                    logger.info(`Sold ${percentage}% of ${token}. TX: ${txid}`);
                } catch (error) {
                    logger.error(`Failed to sell ${token}: ${error}`);
                }
            }
        }
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

        try {
            const txid = await sell("sell", token, Number(percentage), wallet);
            logger.info(`Sold ${percentage}% of ${token}. TX: ${txid}`);
        } catch (error) {
            logger.error(`Failed to sell ${token}: ${error}`);
        }
    }

    await displayPortfolio();
} 