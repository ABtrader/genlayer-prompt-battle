import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export async function testGenLayer(address: string) {
  const client = createClient({
    chain: studionet,
    account: address as `0x${string}`,
  });

  await client.connect("studionet");

  console.log("GenLayer connected");

  return client;
}