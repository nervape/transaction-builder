import { defaultEmptyWitnessArgs, updateWitnessArgs, isScriptValueEquals, getSporeConfig, bytifyRawString } from '@spore-sdk/core';
import { hd, helpers, RPC, Address, Hash, Script, HexString, Transaction } from '@ckb-lumos/lumos';
import { secp256k1Blake160 } from '@ckb-lumos/lumos/common-scripts';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { addressToScript, hexToBytes } from '@nervosnetwork/ckb-sdk-utils';
import { sha256 } from 'js-sha256';

export interface Wallet {
  lock: Script;
  address: Address;
  signMessage(message: HexString): Hash;
  signTransaction(txSkeleton: helpers.TransactionSkeletonType): helpers.TransactionSkeletonType;
  signAndSendTransaction(txSkeleton: helpers.TransactionSkeletonType): Promise<Hash>;
  signRawTransaction(txSkeleton: helpers.TransactionSkeletonType): Promise<Transaction>;
}

/**
 * Create a CKB Default Lock (Secp256k1Blake160 Sign-all) Wallet by a private-key and a SporeConfig,
 * providing lock/address, and functions to sign message/transaction and send the transaction on-chain.
 */
export function createDefaultLockWallet(privateKey: HexString): Wallet {
  const config = getSporeConfig();

  // Generate a lock script from the private key
  const defaultLock = config.lumos.SCRIPTS.SECP256K1_BLAKE160!;
  const lock: Script = {
    codeHash: defaultLock.CODE_HASH,
    hashType: defaultLock.HASH_TYPE,
    args: hd.key.privateKeyToBlake160(privateKey),
  };

  // Generate address from the lock script
  const address = helpers.encodeToAddress(lock, {
    config: config.lumos,
  });

  // Sign for a message
  function signMessage(message: HexString): Hash {
    return hd.key.signRecoverable(message, privateKey);
  }

  // Sign prepared signing entries,
  // and then fill signatures into Transaction.witnesses
  function signTransaction(txSkeleton: helpers.TransactionSkeletonType): helpers.TransactionSkeletonType {
    const signingEntries = txSkeleton.get('signingEntries');
    const signatures = new Map<HexString, Hash>();
    const inputs = txSkeleton.get('inputs');

    let witnesses = txSkeleton.get('witnesses');
    for (let i = 0; i < signingEntries.size; i++) {
      const entry = signingEntries.get(i)!;
      if (entry.type === 'witness_args_lock') {
        // Skip if the input's lock does not match to the wallet's lock
        const input = inputs.get(entry.index);
        if (!input || !isScriptValueEquals(input.cellOutput.lock, lock)) {
          continue;
        }

        // Sign message
        if (!signatures.has(entry.message)) {
          const sig = signMessage(entry.message);
          signatures.set(entry.message, sig);
        }

        // Update signature to Transaction.witnesses
        const signature = signatures.get(entry.message)!;
        const witness = witnesses.get(entry.index, defaultEmptyWitnessArgs);
        witnesses = witnesses.set(entry.index, updateWitnessArgs(witness, 'lock', signature));
      }
    }

    return txSkeleton.set('witnesses', witnesses);
  }

  // Sign the transaction and send it via RPC
  async function signAndSendTransaction(txSkeleton: helpers.TransactionSkeletonType): Promise<Hash> {
    // 1. Sign transaction
    txSkeleton = secp256k1Blake160.prepareSigningEntries(txSkeleton, { config: config.lumos });
    txSkeleton = signTransaction(txSkeleton);

    // 2. Convert TransactionSkeleton to Transaction
    const tx = helpers.createTransactionFromSkeleton(txSkeleton);

    // 3. Send transaction
    const rpc = new RPC(config.ckbNodeUrl);
    return await rpc.sendTransaction(tx, 'passthrough');
  }

  // Sign the transaction and send it via RPC
  async function signRawTransaction(txSkeleton: helpers.TransactionSkeletonType): Promise<Transaction> {
    // 1. Sign transaction
    txSkeleton = secp256k1Blake160.prepareSigningEntries(txSkeleton, { config: config.lumos });
    txSkeleton = signTransaction(txSkeleton);

    // 2. Convert TransactionSkeleton to Transaction
    const tx = helpers.createTransactionFromSkeleton(txSkeleton);

    return tx;
  }

  return {
    lock,
    address,
    signMessage,
    signTransaction,
    signRawTransaction,
    signAndSendTransaction,
  };
}

/**
 * Fetch an image file from local and return an ArrayBuffer.
 * This function is only available in the Node environment.
 */
export async function fetchLocalFile(src: string): Promise<Uint8Array> {
  const buffer = readFileSync(resolve(__dirname, src));
  return new Uint8Array(buffer);
}
const textEncocder = new TextEncoder()

function generateGearId(clusterId: string, receiverAddress: string, tokenId: number) {
  var hash = sha256.create();
  hash.update(hexToBytes(clusterId));
  hash.update(hexToBytes('0x' + tokenId.toString(16)));
  hash.update(receiverAddress);
  return hash.hex().slice(0, 16);
}

export function buildSporesData(
  mintList: { address: string, bg: string, view: number }[],
  clusterId: string
) {
  return mintList.map(({ address, bg, view }, index: number) => {
    const viewIndex = hexToBytes(view)
    const gearId = generateGearId(clusterId, address, index + 1)
    const content = Buffer.concat([textEncocder.encode(bg), viewIndex, hexToBytes(`0x${gearId}`)]).toString('hex')
    return {
      toLock: addressToScript(address),
      data: {
        contentType: 'dob/0',
        content: bytifyRawString(`"${content}"`),
        clusterId: clusterId
      }
    }
  })
}


export function getRandomElement<T>(arr: T[]): T {
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}



export interface Material {
  type: string;
  tx_hash: string;
  index: string;
  amount: number; // or string, depending on your actual data structure
}