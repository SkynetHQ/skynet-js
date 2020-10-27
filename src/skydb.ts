import { pki } from "node-forge";
import { SkynetClient } from "./client";
import { HashRegistryEntry, PublicKey, SecretKey } from "./crypto";
import { RegistryEntry } from "./registry";
import { parseSkylink, trimUriPrefix, uriSkynetPrefix } from "./utils";

export async function getJSON(
  this: SkynetClient,
  publicKey: PublicKey,
  dataKey: string
): Promise<{ data: Record<string, unknown>; revision: number } | null> {
  // lookup the registry entry
  console.log(10);
  const entry = await this.registry.getEntry(publicKey, dataKey);
  if (entry === null) {
    return null;
  }
  console.log(11);

  // Download the data in that Skylink
  // TODO: Replace with download request method.
  const skylink = parseSkylink(entry.value.data);

  const response = await this.executeRequest({
    ...this.customOptions,
    method: "get",
    url: this.getSkylinkUrl(skylink),
  });
  console.log(12);

  return { data: response.data, revision: entry.revision };
}

export async function setJSON(
  this: SkynetClient,
  privateKey: SecretKey,
  dataKey: string,
  json: Record<string, unknown>,
  revision?: number
): Promise<boolean> {
  // Upload the data to acquire its skylink
  // TODO: Replace with upload request method.
  console.log(1);
  const file = new File([JSON.stringify(json)], dataKey, { type: "application/json" });
  const { skylink } = await this.uploadFileRequest(file, this.customOptions);
  console.log(2);

  const publicKey = pki.ed25519.publicKeyFromPrivateKey({ privateKey });
  if (!revision) {
    // fetch the current value to find out the revision.
    console.log(3);
    const entry = await this.registry.getEntry(publicKey, dataKey);
    console.log(4);

    if (entry) {
      // verify here
      console.log(5);
      if (
        !pki.ed25519.verify({
          message: HashRegistryEntry(entry.entry),
          signature: entry.signature,
          publicKey,
        })
      ) {
        console.log(6);
        throw new Error("could not verify signature");
      }

      revision = entry.revision + 1;
    } else {
      revision = 0;
      console.log(7);
    }
  }

  console.log(8);
  // build the registry value
  const entry: RegistryEntry = {
    data: trimUriPrefix(skylink, uriSkynetPrefix),
    revision,
  };

  // sign it
  const signature = pki.ed25519.sign({
    message: HashRegistryEntry(entry),
    privateKey,
  });

  console.log(9);
  // update the registry
  return this.registry.setEntry(publicKey, dataKey, entry, signature);
}
