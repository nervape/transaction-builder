//import "./global-proxy";
import dotenv from 'dotenv';
import fs from "fs"
import path from 'path';
import { sha256 } from 'js-sha256';
import { AddressPrefix, hexToBytes, addressToScript, privateKeyToAddress } from '@nervosnetwork/ckb-sdk-utils';
import { NetworkType, utf8ToBuffer } from '@rgbpp-sdk/btc';
import {
  Collector,
} from '@rgbpp-sdk/ckb';

dotenv.config();
//dotenv.config({ path: path.join(__dirname, "../.env.ckb-testnet") })

export const CKB_PRIVATE_KEY = process.env.PRIVATE_KEY!;
export const network: string | undefined = process.env.NETWORK;
export const isMainnet: boolean = network !== undefined && network !== "testnet" && network !== "TESTNET";

export function getDeployVariables() {
  const networkType = isMainnet ? NetworkType.MAINNET : NetworkType.TESTNET;

  const collector = new Collector({
    ckbNodeUrl: process.env.CKB_NODE_URL!,
    ckbIndexerUrl: process.env.CKB_INDEXER_URL!,
  });

  const ckbAddress = privateKeyToAddress(CKB_PRIVATE_KEY, {
    prefix: isMainnet ? AddressPrefix.Mainnet : AddressPrefix.Testnet,
  });
  const ckbMasterLock = addressToScript(ckbAddress);
  
  return {
    collector,
    ckbAddress,
    ckbMasterLock
  }
}

export function getClusterData() {
  const file = path.join(__dirname, `../data/${network}/cluster.json`)
  const {name, description} = JSON.parse(fs.readFileSync(file).toString())
  return {
    name,
    description: JSON.stringify(description)
  }
}

export function getClusterIdIndex(cluster_id: string): number | null {
    const file = path.join(__dirname, `../data/${network}/clusters.json`);
    let cluster_info: { cluster_id: string; index: number; }[];
    try {
        cluster_info = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        console.error(`Error reading or parsing file: ${err}`);
        return null;
    }

    const cluster = cluster_info.find(ci => ci.cluster_id === cluster_id);
    
    if (cluster) {
        return cluster.index;
    } else {
        console.warn(`Cluster ID ${cluster_id} not found.`);
        return null;
    }
}

export function getClusterBgData(cluster_id: string) : { bg: string; view: number; }[] | null {
    const file = path.join(__dirname, `../data/${network}/cluster-${cluster_id}-bg.json`)
    const index =  getClusterIdIndex(cluster_id);
    if (index){
        const file = path.join(__dirname, `../data/${network}/cluster-${index}.bg.json`);
        const bgData: { bg: string; view: number; }[] = JSON.parse(fs.readFileSync(file).toString());
        return bgData
    } else {
        return null
    }
}

export function checkStepExists(step: string, batchNO: number) {
  const file = path.join(__dirname, `../logs/${network}/step-${step}-${batchNO}.log`)
  return fs.existsSync(file)
}

export function getMintList(batchNo: number) {
  if(batchNo <=0) throw new Error("Invalid batch no");
  const file = path.join(__dirname, `./data/${network}/mint-list.json`)
  const start = (batchNo - 1) * 100
  const end = batchNo * 100
  return JSON.parse(fs.readFileSync(file).toString()).slice(start, end)
}

export function calculateDNA(btcClusterBlockHeight: number, tokenId: number, receiverAddress: string) {
  var hash = sha256.create();
  hash.update(hexToBytes('0x' + btcClusterBlockHeight.toString(16)));
  hash.update(hexToBytes('0x' + tokenId.toString(16)));
  hash.update(receiverAddress);
  return hash.hex().slice(0, 32);
}

export function buildReceiversAndSpores(
  mintList: { address: string, token_id: number}[], 
  clusterId: string, 
  clusterBlockHeight: number
) {
  return mintList.map(({ address, token_id }) => {
    const dna = calculateDNA(clusterBlockHeight, token_id, address)
    return {
      toBtcAddress: address,
      sporeData: {
        contentType: 'dob/0',
        content: utf8ToBuffer(JSON.stringify({
          "id": token_id,
          "dna": dna,
        })),
        clusterId: clusterId
      }
    }
  })
}


export function writeStepLog(step: string, data: any) {
  const file = path.join(__dirname, `../logs/${network}/step-${step}.log`)
  if(typeof data !== 'string'){
    data = JSON.stringify(data)
  } 
  fs.writeFileSync(file, data);
}

export function readStepLog(step: string) {
  const file = path.join(__dirname, `../logs/${network}/step-${step}.log`)
  return JSON.parse(fs.readFileSync(file).toString());
}

export function checkCkbStepExists(step: string) {
  const file = path.join(__dirname, `../logs/ckb-${network}/step-${step}.log`)
  return fs.existsSync(file)
}

export function writeCkbStepLog(step: string, data: any) {
  const file = path.join(__dirname, `../logs/ckb-${network}/step-${step}.log`)
  if (typeof data !== 'string') {
    data = JSON.stringify(data)
  }
  fs.writeFileSync(file, data);
}

export function readCkbStepLog(step: string) {
  const file = path.join(__dirname, `../logs/ckb-${network}/step-${step}.log`)
  return JSON.parse(fs.readFileSync(file).toString());
}