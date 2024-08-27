import { Context } from "koa";
import { wallet, rpcConfig } from "../services/serviceConfig";
import { handleSporeTransaction } from "../services/sporeService";

export async function forgeHandler(ctx: Context) {
  console.log(ctx.request.body);
  const { sender, materials, cluster_id, reward, capacity, refund, gear_id } =
    ctx.request.body;
  try {
    const txSkeleton = await handleSporeTransaction(
      materials,
      sender,
      cluster_id,
      gear_id,
      reward,
      capacity,
      refund,
      wallet,
      rpcConfig
    );

    //const signed = await wallet.signRawTransaction(txSkeleton);
    //const jsonResult = JSON.stringify(ParamsFormatter.toRawTransaction(signed));
    //console.log("txSkeleton: ", jsonResult);
    const hash = await wallet.signAndSendTransaction(txSkeleton);
    console.log("tx_hash:", hash);
    const result = JSON.stringify({
      tx_hash: hash,
      txSkeleton: txSkeleton,
      status: 0,
      message: "success",
    });
    console.log(result);
    ctx.body = result;
  } catch (e) {
    console.log(e);
    const result = JSON.stringify({
      tx_hash: null,
      txSkeleton: null,
      status: -1,
      message: "failed",
    });
    ctx.body = result;
  }
}
