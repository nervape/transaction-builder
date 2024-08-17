import * as dotenv from 'dotenv';
import { predefinedSporeConfigs } from '@spore-sdk/core';
import { predefined } from '@ckb-lumos/config-manager';
import { createDefaultLockWallet } from '../helpers';

// Load environment variables from .env file
dotenv.config();

const private_key: string = process.env.PRIVATE_KEY!;
const ckb_network: string | undefined = process.env.NETWORK;
const isMainnet: boolean = ckb_network !== undefined && ckb_network !== "TESTNET";

export const rpcConfig = isMainnet ? predefinedSporeConfigs.Mainnet : predefinedSporeConfigs.Testnet;
export const lumosConfig = isMainnet ? predefined.LINA : predefined.AGGRON4;

rpcConfig.ckbIndexerUrl = process.env.CKB_INDEXER_URL!;
rpcConfig.ckbNodeUrl = process.env.CKB_NODE_URL!;

export const wallet = createDefaultLockWallet(private_key);
console.log("Using private key from address: ", wallet.address);
console.log(rpcConfig);