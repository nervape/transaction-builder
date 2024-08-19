import { buildSporesData } from '../helpers';
import { meltMultipleThenCreateSpore, createSpore, SporeConfig, returnExceededCapacityAndPayFee } from '@spore-sdk/core';
import { formatUnit, parseUnit } from '@ckb-lumos/lumos/utils';

export async function handleSporeTransaction(materials: any[], senderAddress: string, cluster_id: string, reward: {
    id: string,
    name: string,
    btcfs: {
        bg: string,
        view: number,
    }
}, capacity_ckb: number, refund_ckb: number, wallet: any, rpcConfig: SporeConfig) {
    const outPoints = materials.filter((m) => m.type === 'Spore').map((m) => ({
        txHash: `${m.tx_hash}`,
        index: m.index,
    }));

    const spore_data = buildSporesData([{
        address: senderAddress,
        bg: reward.btcfs.bg,
        view: reward.btcfs.view
    }], cluster_id);

    console.log(outPoints, spore_data);
    console.log(`capacity: ${parseUnit(`${refund_ckb}`, "ckb").toHexString()}`)

    // the refund cell
    const postOutput = {
        cellOutput: {
            capacity: parseUnit(`${refund_ckb}`, "ckb").toHexString(),
            lock: spore_data[0].toLock,
        },
        data: "0x",
    };

    let txSkeleton;
    let outputIndex: number;
    if (outPoints.length > 0) {
        ({ txSkeleton, outputIndex } = await meltMultipleThenCreateSpore({
            outPoints,
            data: spore_data[0].data,
            toLock: spore_data[0].toLock,
            fromInfos: [wallet.address],
            config: rpcConfig,
            postOutputs: [postOutput],
        }));

        // setting spore capacity
        let outputs = txSkeleton.get("outputs");
        let spore_cell = outputs.get(outputIndex)!;
        spore_cell.cellOutput.capacity = parseUnit(`${capacity_ckb}`, "ckb").toHexString();
        outputs = outputs.update(outputIndex, _ => spore_cell);
        txSkeleton = txSkeleton.update("outputs", (outputs) => outputs);
        
        const injectResult = await returnExceededCapacityAndPayFee({
            txSkeleton,
            changeAddress: wallet.address,
            config: rpcConfig,
            //feeRate: parseUnit("1000", "shannon")
        });
        txSkeleton = injectResult.txSkeleton;
    } else {
        ({ txSkeleton } = await createSpore({
            data: spore_data[0].data,
            toLock: spore_data[0].toLock,
            fromInfos: [wallet.address],
            config: rpcConfig,
        }));

        const injectResult = await returnExceededCapacityAndPayFee({
            txSkeleton,
            changeAddress: wallet.address,
            config: rpcConfig,
            //feeRate: parseUnit("1000", "shannon")
        });
        txSkeleton = injectResult.txSkeleton;
    }
    return txSkeleton;
}
