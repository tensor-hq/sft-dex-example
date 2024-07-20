import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import { AxiosInstance } from "axios";

export interface BaseArgs {
  connection: Connection;
  axios: AxiosInstance;
  market: PublicKey;
}

export interface ListArgs extends BaseArgs {
  payer: Keypair;
  maker: Keypair;
  priceInTicks: number;
  numBaseLots: number;
}

export interface EditArgs extends BaseArgs {
  maker: Keypair;
  orderSequenceNumber: number;
  newNumBaseLots: number;
}

export interface BuyArgs extends BaseArgs {
  trader: Keypair;
  amount: number;
}

export interface CancelArgs extends BaseArgs {
  payer: Keypair;
  maker: Keypair;
  orderSequenceNumber: number;
}

export async function list(args: ListArgs) {
  const { connection, axios, payer, market, maker, priceInTicks, numBaseLots } =
    args;

  // List SFTs on the market
  const { data: listData } = await axios.get("list", {
    params: {
      payer: payer.publicKey.toString(),
      market: market.toString(),
      maker: maker.publicKey.toString(),
      priceInTicks,
      numBaseLots,
    },
  });

  const buffer = Buffer.from(listData);

  const tx = VersionedTransaction.deserialize(buffer);
  tx.sign([payer, maker]);

  const sig = await connection.sendTransaction(tx);
  console.log("listed SFTs:", sig);
}

export async function edit(args: EditArgs) {
  const {
    connection,
    axios,
    maker,
    market,
    orderSequenceNumber,
    newNumBaseLots,
  } = args;

  // List SFTs on the market
  const { data: editData } = await axios.get("edit", {
    params: {
      market: market.toString(),
      maker: maker.publicKey.toString(),
      orderSequenceNumber,
      newNumBaseLots,
    },
  });

  const buffer = Buffer.from(editData);

  const tx = VersionedTransaction.deserialize(buffer);
  tx.sign([maker]);

  console.log("submitting transaction...");

  const sig = await connection.sendTransaction(tx);
  console.log("edited order:", sig);
}

export async function buy(args: BuyArgs) {
  const { connection, axios, market, trader, amount } = args;

  // Trader buys the listed SFTs
  const { data: buyData } = await axios.get("buy", {
    params: {
      market: market.toString(),
      trader: trader.publicKey.toString(),
      amount,
    },
  });

  const buffer = Buffer.from(buyData);

  const tx = VersionedTransaction.deserialize(buffer);
  tx.sign([trader]);

  const sig = await connection.sendTransaction(tx);
  console.log("bought SFTs:", sig);
}

export async function cancel(args: CancelArgs) {
  const { connection, axios, payer, market, maker, orderSequenceNumber } = args;

  // Maker cancels the listed SFTs.
  const { data: buyData } = await axios.get("cancel", {
    params: {
      payer: payer.publicKey.toString(),
      market: market.toString(),
      trader: maker.publicKey.toString(),
      orderSequenceNumber,
    },
  });

  const tx = VersionedTransaction.deserialize(Buffer.from(buyData));
  tx.sign([payer, maker]);

  const sig = await connection.sendTransaction(tx);
  console.log("canceled order number:", orderSequenceNumber, sig);
}

export async function getListings(axios: AxiosInstance, market: PublicKey) {
  const { data } = await axios.get("listings", {
    params: {
      market: market.toString(),
    },
  });

  console.log(data);
}
