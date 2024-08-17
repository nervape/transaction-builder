import fs from "fs"
import path from 'path';
import { bytesToHex, getTransactionSize, privateKeyToAddress } from '@nervosnetwork/ckb-sdk-utils';
import { packRawClusterData } from '@spore-sdk/core';
import {
  Collector,
  MAX_FEE,
  NoLiveCellError,
  SECP256K1_WITNESS_LOCK_SIZE,
  append0x,
  calculateTransactionFee,
  getSecp256k1CellDep,
  generateClusterId,
  getClusterTypeScript,
  Hex,
  getClusterTypeDep,
  generateClusterCreateCoBuild,
  CKB_UNIT
} from '@rgbpp-sdk/ckb';

import { isMainnet, network, getDeployVariables, CKB_PRIVATE_KEY, writeCkbStepLog, readCkbStepLog, checkCkbStepExists } from "../config"


export function getClusterData(clusterNo: number, isMainnet: boolean) {
  const file = path.join(__dirname, `../../data/${isMainnet ? 'mainnet' : 'testnet'}/cluster-${clusterNo}.json`)
  const { name, description } = JSON.parse(fs.readFileSync(file).toString())
  return {
    name,
    description: JSON.stringify(description)
  }
}

const createClusterCell = async (clusterNo: number) => {
  const { collector, ckbMasterLock } = getDeployVariables()
  const clusterData = getClusterData(clusterNo, isMainnet)

  const calculateClusterCellCapacity = (): bigint => {
    const clusterDataSize = packRawClusterData(clusterData).length;
    const clusterTypeSize = 32 + 1 + 32;
    const SECP256K1_LOCK_SIZE = 32 + 1 + 20
    const cellSize = SECP256K1_LOCK_SIZE + clusterTypeSize + 8 + clusterDataSize;
    return BigInt(cellSize + 1) * CKB_UNIT;
  };

  // The capacity required to launch cells is determined by the token info cell capacity, and transaction fee.
  const clusterCellCapacity = calculateClusterCellCapacity();

  let emptyCells = await collector.getCells({
    lock: ckbMasterLock,
  });
  if (!emptyCells || emptyCells.length === 0) {
    throw new NoLiveCellError('The address has no empty cells');
  }
  emptyCells = emptyCells.filter((cell: any) => !cell.output.type);

  let txFee = MAX_FEE;
  const { inputs, sumInputsCapacity } = collector.collectInputs(emptyCells, clusterCellCapacity, txFee);

  const clusterId = generateClusterId(inputs[0], 0);
  const outputs: CKBComponents.CellOutput[] = [
    {
      lock: ckbMasterLock,
      type: {
        ...getClusterTypeScript(isMainnet),
        args: clusterId,
      },
      capacity: append0x(clusterCellCapacity.toString(16))
    },
  ];

  let changeCapacity = sumInputsCapacity - clusterCellCapacity;
  outputs.push({
    lock: ckbMasterLock,
    capacity: append0x(changeCapacity.toString(16)),
  });

  const rawClusterData = packRawClusterData(clusterData)

  const outputsData: Hex[] = [bytesToHex(rawClusterData), '0x'];
  const cellDeps = [
    getSecp256k1CellDep(isMainnet), 
    getClusterTypeDep(isMainnet)
  ];
  const sporeCoBuild = generateClusterCreateCoBuild(outputs[0], outputsData[0]);

  const emptyWitness = { lock: '', inputType: '', outputType: '' };
  const witnesses: any[] = inputs.map((_, index) => (index === 0 ? emptyWitness : '0x'));
  witnesses.push(sporeCoBuild)

  const unsignedTx = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs,
    outputs,
    outputsData,
    witnesses,
  };

  const txSize = getTransactionSize(unsignedTx);
  const estimatedTxFee = calculateTransactionFee(txSize);
  changeCapacity -= estimatedTxFee;
  unsignedTx.outputs[unsignedTx.outputs.length - 1].capacity = append0x(changeCapacity.toString(16));
  const signedTx = collector.getCkb().signTransaction(CKB_PRIVATE_KEY)(unsignedTx);

  const txHash = await collector.getCkb().rpc.sendTransaction(signedTx, 'passthrough');
  console.info(`Cluster cell submitted and the tx hash ${txHash}`);

  writeCkbStepLog(`${clusterNo}-0`, {
    clusterId,
    outPoint: {
      txHash,
      index: 0
    }
  })

  const interval = setInterval(async () => {
    try {
      console.log("Waiting for cluster cell confirmed")
      const tx = await collector.getCkb().rpc.getTransaction(txHash)
      if (tx.txStatus.status === 'committed') {
        clearInterval(interval)
        console.info(`Cluster cell has been created and the tx hash ${txHash}`);
      }
    } catch (error) {
      console.error(error)
    }
  }, 5 * 1000)
};

export function checkClusterCreated(clusterNo: string | number) {
  const file = path.join(__dirname, `../../logs/ckb-${network}/step-${`${clusterNo}-0`}.log`)
  return fs.existsSync(file)
}

const clusterNo = process.argv[2]
if (!clusterNo) {
  throw new Error("No `clusterNo`");
}

const created = checkClusterCreated(clusterNo)
if (created) {
  throw new Error(`Cluster ${clusterNo} created`);
}
console.log("cluster = ", parseInt(clusterNo))

createClusterCell(parseInt(clusterNo));