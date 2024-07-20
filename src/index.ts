import { Connection } from "@solana/web3.js";
import axios from "axios";
import { buy, cancel, edit, getListings, list } from "./api-helpers";
import { createTestMarket } from "./market";
import { getKeypairs, getMarketConfig } from "./utils";

// The base URL for the Tensor API.
const API_BASE_URL = "http://api.devnet.tensordev.io/api/v1/sft/";

async function main() {
  // We use this connection to set up some SPL mints to act as our base and quote tokens.
  // For production use these will likely already exist.
  const connection = new Connection(
    "http://api.devnet.solana.com",
    "confirmed"
  );

  // Our AxiosInstance to interact with the Tensor API.
  const ax = axios.create({
    baseURL: API_BASE_URL,
    timeout: 5_000,
    headers: {
      // Tensor Devnet API key.
      "X-TENSOR-API-KEY": process.env.X_TENSOR_API_KEY,
    },
  });

  // Need the following keypairs funded with SOL for this example:
  // - payer -- the account that will pay for the transactions
  // - maker -- provides liquidity by posting orders
  // - trader -- trades against the maker's orders
  // - marketAuthority -- the authority for the market, required to approve a seat for a new maker

  // Generate the keypairs or get them from somewhere: file, etc.
  // Devnet's airdrop function is heavily rate-limited so the keypairs need to be funded outside this script.
  const { payer, maker, trader, marketAuthority } = await getKeypairs();

  // This setups a test market with a base token representing a SFT, and a quote token representing a SPL token
  // like USDC to be used as the pricing token.
  await createTestMarket({
    connection,
    axios: ax,
    payer,
    marketAuthority,
    maker: maker.publicKey,
    trader: trader.publicKey,
    marketParams: {
      takerFeeBps: 100, // 1% taker fee
      minOrderSize: 1, // SFTs must be purchased as whole amounts, in this market.
      tickSize: 0.01, // 0.01 USDC
    },
  });

  // Once a market is created we can read it from the disk to test other functions without creating a new market each time.
  const { market, baseMint, quoteMint } = await getMarketConfig();

  // All the helper transaction functions take these base args.
  const baseArgs = {
    connection,
    axios: ax,
    market,
  };

  // Listing requires a price in ticks and the number of base lots to list.
  // Each market has a designated tick size (quote lots per base unit) that is used to convert the price to ticks.
  // A tick size of 0.01 and a price of 1.23 is converted to 123 ticks.
  const priceInTicks = 175; // $1.75 USDC
  const numBaseLots = 100; // Listing 100 SFTs for $1.75 each.

  // List the SFTs for sale.
  await list({
    ...baseArgs,
    payer,
    maker, // Maker must have a seat in the market to list.
    priceInTicks,
    numBaseLots,
  });

  // Delay 2000 ms to give the listing time to post.
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Fetch and display the listings from the market.
  // We can add methods to fetch all markets and fetch all listings by maker.
  await getListings(ax, market);

  // The trader buys some of the listed SFTs.
  await buy({
    ...baseArgs,
    trader,
    amount: 10, // whole tokens
  });

  // The maker can cancel their listing.
  await cancel({
    ...baseArgs,
    payer,
    maker,
    orderSequenceNumber: 3, // The sequence number of the order to cancel.
  });

  // The maker can update their listing.
  // Note: Phoenix supports reducing an existing listing order size, but not increasing it. Increasing the order size
  // using this handler cancels the existing order and creates a new one with the new size, resulting in a new order sequence number.
  await edit({
    ...baseArgs,
    maker,
    orderSequenceNumber: 1,
    newNumBaseLots: 1000,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
