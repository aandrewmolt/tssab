# TSSAB - T
A comprehensive trading system for automated trading on the Solana blockchain.

## Features

- Copy Trading Bot
  - Automatically copy trades from specified wallets
  - Configurable take profit and stop loss
  - Real-time transaction monitoring
  
- Portfolio Management
  - View and manage your token portfolio
  - Interactive CLI interface
  - Real-time price tracking
  
- Transaction Management
  - Support for Jito MEV
  - Automatic fallback mechanisms
  - Transaction retry logic
  
- Advanced Features
  - Raydium DEX integration
  - Multiple RPC endpoint support
  - Automatic price monitoring

## Installation

1. Clone the repository:
```bash
git clone https://github.com/aandrewmolt/tssab.git
cd tssab
```

2. Install dependencies:
```bash
npm install
```

3. Configure your environment:
- Copy `.env.example` to `.env`
- Update the values in `.env` with your settings

## Usage

### Copy Trading
```bash
ts-node src/trading_dev/cli.ts copy-trade
```

### Portfolio Management
```bash
ts-node src/trading_dev/cli.ts portfolio
```

### Dashboard
```bash
ts-node src/trading_dev/dashboard.ts
```

## Configuration

Key configuration options in `.env`:
- `PRIVATE_KEY`: Your wallet's private key
- `SMART_MONEY_WALLET`: Wallet address to copy trades from
- `TAKE_PROFIT`: Take profit percentage
- `STOP_LOSS`: Stop loss percentage
- `JITO_FEE`: Fee for Jito transactions

## License

MIT License - see LICENSE file for details
