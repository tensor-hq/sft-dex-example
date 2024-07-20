import { Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";

export async function getKeypairs() {
  const payerSk = new Uint8Array(
    JSON.parse(readFileSync("payer.json", "utf8"))
  );
  const makerSk = new Uint8Array(
    JSON.parse(readFileSync("maker.json", "utf8"))
  );
  const traderSk = new Uint8Array(
    JSON.parse(readFileSync("trader.json", "utf8"))
  );
  const marketAuthoritySk = new Uint8Array(
    JSON.parse(readFileSync("marketAuthority.json", "utf8"))
  );

  const payer = Keypair.fromSecretKey(payerSk);
  const maker = Keypair.fromSecretKey(makerSk);
  const trader = Keypair.fromSecretKey(traderSk);
  const marketAuthority = Keypair.fromSecretKey(marketAuthoritySk);

  return { payer, maker, trader, marketAuthority };
}

export async function getMarketConfig() {
  let { market, baseMint, quoteMint } = JSON.parse(
    readFileSync("market.json", "utf8")
  );

  market = new PublicKey(market);
  baseMint = new PublicKey(baseMint);
  quoteMint = new PublicKey(quoteMint);

  return { market, baseMint, quoteMint };
}
