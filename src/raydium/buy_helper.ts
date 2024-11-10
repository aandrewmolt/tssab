import { Keypair } from "@solana/web3.js";
import { swap } from "./Pool/swap";

export async function buy(side: string, address: string, no_of_sol: number, payer: Keypair): Promise<string> {
  const txid = await swap(side, address, no_of_sol, -1, payer, "trade");
  return txid || '';
}

export async function get_buy_transaction(
  side: string,
  tokenAddr: string,
  buy_AmountOfSol: number,
  payer_wallet: Keypair
) {
  const innerTransaction = await swap(
    side,
    tokenAddr,
    buy_AmountOfSol,
    -1,
    payer_wallet,
    "volume"
  );
  return innerTransaction;
}
