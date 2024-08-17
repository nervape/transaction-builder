import { buildSporesData } from '../helpers';
import { meltMultipleThenCreateSpore, createSpore, SporeConfig, returnExceededCapacityAndPayFee } from '@spore-sdk/core';
import { formatUnit } from '@ckb-lumos/lumos/utils';

export async function handleSporeTransaction(materials: any[], senderAddress: string, cluster_id: string, reward: {
    id: string,
    name: string,
    btcfs: {
        bg: string,
        view: number,
    }
}, refund_ckb: number, wallet: any, rpcConfig: SporeConfig) {
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

    // the refund cell
    const postOutput = {
        cellOutput: {
            capacity: formatUnit(refund_ckb, "ckb"),
            lock: spore_data[0].toLock,
        },
        data: "0x",
    };

    let txSkeleton;
    if (outPoints.length > 0) {
        ({ txSkeleton } = await meltMultipleThenCreateSpore({
            outPoints,
            data: spore_data[0].data,
            toLock: spore_data[0].toLock,
            fromInfos: [wallet.address],
            config: rpcConfig,
            postOutputs: [postOutput],
        }));
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
