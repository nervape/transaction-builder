import { Context } from 'koa';
import { CKBRPC } from '@ckb-lumos/lumos/rpc';
import { wallet, rpcConfig, lumosConfig } from '../services/serviceConfig';
import { parseAddress } from '@ckb-lumos/lumos/helpers';
import { transferMultipleSpore } from '@spore-sdk/core';
import { Material } from '../helpers';

export async function returnHandler(ctx: Context) {
    const { sender, materials, tx_hash } = ctx.request.body;
    const rpc = new CKBRPC(rpcConfig.ckbNodeUrl);

    const outPoints = materials
        .filter((m: Material) => m.type === 'Spore')
        .map((m: Material) => ({
            txHash: m.tx_hash,
            index: m.index,
        }));

    const ckbOutPoints = materials
        .filter((m: Material) => m.type === 'Ckb')
        .map((m: Material) => ({
            txHash: m.tx_hash,
            index: m.index,
            capacity: m.amount as number,
        }));


    const senderScript = parseAddress(sender, { config: lumosConfig });

    let { txSkeleton } = await transferMultipleSpore({
        outPoints,
        toLock: senderScript,
        fromInfos: [wallet.address],
        useCapacityMarginAsFee: true,
        config: rpcConfig,
    });
    console.log("txSkeleton: ", txSkeleton);
    const hash = await wallet.signAndSendTransaction(txSkeleton);
    const result = JSON.stringify({
        tx_hash: hash,
        txSkeleton: txSkeleton
    });
    ctx.body = result
}
