import { createAccount, createMint, mintTo } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import { AxiosInstance } from "axios";
import { writeFileSync } from "fs";

interface MarketSetup {
  payer: Keypair;
  marketAuthority: Keypair;
  market: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
}

interface MarketParams {
  // Taker fee in basis points.
  takerFeeBps: number;
  // Minimum order size in base tokens.
  minOrderSize: number;
  // Minimum price increment in quote currency units.
  tickSize: number;
}

interface TestMarketArgs {
  connection: Connection;
  axios: AxiosInstance;
  payer: Keypair;
  marketAuthority: Keypair;
  maker: PublicKey;
  trader: PublicKey;
  marketParams: MarketParams;
}

// Create a market setup for testing w/ a simulated SOL/USDC pair.
export async function createTestMarket(args: TestMarketArgs) {
  const {
    connection,
    axios,
    payer,
    marketAuthority,
    maker,
    trader,
    marketParams,
  } = args;

  // A new keypair for our market--does not need to be funded.
  const market = Keypair.generate();

  // Mint Authority keypair for controlling mints. Does not need to be funded.
  const mintAuthority = Keypair.generate();

  console.log("Creating mints...");

  // Simulate SFT mint.
  const baseMint = await createMint(
    connection,
    payer,
    mintAuthority.publicKey, // mint authority
    mintAuthority.publicKey, // freeze authority
    0, // 0 decimals
  );

  // Simulate USDC mint.
  const quoteMint = await createMint(
    connection,
    payer,
    mintAuthority.publicKey, // mint authority
    mintAuthority.publicKey, // freeze authority
    6,
  );

  console.log("Minting assets to maker and trader...");

  // Mint base asset to maker.
  const baseToken = await createAccount(connection, payer, baseMint, maker);
  await mintTo(connection, payer, baseMint, baseToken, mintAuthority, 1000);

  // Mint quote asset to trader.
  const quoteToken = await createAccount(connection, payer, quoteMint, trader);
  await mintTo(connection, payer, quoteMint, quoteToken, mintAuthority, 1000e6);

  console.log("getting initialize market tx...");

  // Get the initialize market transaction.
  const response = await axios.get("initialize-market", {
    params: {
      payer: payer.publicKey.toBase58(),
      marketAuthority: marketAuthority.publicKey.toBase58(),
      baseMint: baseMint.toBase58(),
      quoteMint: quoteMint.toBase58(),
      market: market.publicKey.toBase58(),
      ...marketParams,
    },
  });

  // Deserialize the transaction from the response.
  let buffer = Buffer.from(response.data);
  let tx = VersionedTransaction.deserialize(buffer);

  // Sign the transaction with the appropriate keypairs.
  tx.sign([payer, market, marketAuthority]);

  // Send the transaction to the network...
  let sig = await connection.sendTransaction(tx);
  // ...and wait for confirmation.
  await connection.confirmTransaction(sig);
  console.log("Initialize market transaction:", sig);

  console.log("approving maker seat...");
  // Currently the market authority must manually approve a new seat for a maker.
  const { data: approveData } = await axios.get("approve-seat", {
    params: {
      payer: payer.publicKey.toString(),
      market: market.publicKey.toString(),
      trader: maker.toString(),
      marketAuthority: marketAuthority.publicKey.toString(),
    },
  });

  // Deserialize the transaction from the response.
  buffer = Buffer.from(approveData);
  tx = VersionedTransaction.deserialize(buffer);

  // Sign the transaction with the appropriate keypairs.
  tx.sign([marketAuthority, payer]);

  // Send and confirm the transaction.
  sig = await connection.sendTransaction(tx);
  await connection.confirmTransaction(sig);
  console.log("approved seat:", sig);

  const marketConfig = {
    market: market.publicKey,
    baseMint,
    quoteMint,
  };

  // Write generated data to the disk for later use.
  writeFileSync(
    "mintAuthority.json",
    JSON.stringify(Array.from(mintAuthority.secretKey)),
  );
  writeFileSync("market.json", JSON.stringify(marketConfig));
}
