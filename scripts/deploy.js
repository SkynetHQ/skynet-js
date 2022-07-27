/**
 * Script to deploy skynet-js to an hns domain.
 *
 * # Example usage
 *
 * $ SKYNET_JS_DEPLOY_SEED="..." node ./scripts/deploy.js
 *
 * $ SKYNET_JS_DEPLOY_SEED="..." SKYNET_JS_DEPLOY_DOMAIN="my-domain" node ./scripts/deploy.js --portal-url https://skynetpro.net --skynet-api-key <api-key>
 *
 * # Options
 *
 * --portal-url        Your preferred Skynet portal.
 * --skynet-api-key    API key for the portal.
 * --hns-domain        The HNS domain to deploy to. Can also use
 *                     the 'SKYNET_JS_DEPLOY_DOMAIN' env var.
 *
 * # First time use
 *
 * You can generate the required seed with `genKeyPairAndSeed`.
 *
 * The first time you run this for a given hns domain, there won't be any data
 * on the domain. Setting `skipDownload` will skip the download. After the
 * upload, set the TXT record for the hns domain to the resulting resolver
 * skylink.
 */

/* eslint-disable @typescript-eslint/no-var-requires */

const {
  genKeyPairFromSeed,
  SkynetClient,
  stringToUint8ArrayUtf8,
  uriSkynetPrefix,
} = require("@skynetlabs/skynet-nodejs");

const fs = require("fs");
const fse = require("fs-extra");
const parseArgs = require("minimist");
const process = require("process");
const tar = require("tar-fs");

// The env var with the secret seed phrase to deploy with. (Required)
const deploySeedEnvVar = "SKYNET_JS_DEPLOY_SEED";
// The env var with the HNS domain to deploy to. (Optional)
const deployDomainEnvVar = "SKYNET_JS_DEPLOY_DOMAIN";

// Get arguments.
const argv = parseArgs(process.argv.slice(2));
// Portal URL.
const portalUrl = argv["portal-url"] || "https://siasky.net";
// API key for portal.
const skynetApiKey = argv["skynet-api-key"] || undefined;
// The HNS domain to deploy to.
const hnsDomain = argv["hns-domain"] || process.env[deployDomainEnvVar] || "skynet-js";

// The location of the bundle to deploy. Must be a folder.
const bundlePath = "bundle";
// Location of package.json, used to get the latest version.
const packageJson = "../package.json";
// Set to true to skip the download. Useful for debugging.
const skipDownload = false;
// Set to true to skip the upload. Useful for debugging.
const skipUpload = false;
const dataKey = "skynet-js";
const versionsDir = "versions";
const versionsTarFile = `${versionsDir}.tar`;

void (async () => {
  const client = new SkynetClient(portalUrl, { skynetApiKey });

  // Validation.

  const seed = process.env[deploySeedEnvVar];
  if (!skipUpload && !seed) {
    throw new Error(`Seed not found (required for upload), make sure 'SKYNET_JS_DEPLOY_SEED' is set`);
  }

  // Get the latest version from package.json.

  const version = require(packageJson).version;
  console.log(`Version: ${version}`);

  // Download the existing version directory.

  if (fs.existsSync(versionsDir)) {
    fs.rmSync(versionsDir, { recursive: true });
  }
  if (fs.existsSync(versionsTarFile)) {
    fs.rmSync(versionsTarFile);
  }

  if (!skipDownload) {
    try {
      console.log(`Downloading HNS domain '${hnsDomain}' -> '${versionsTarFile}'`);
      await client.downloadFileHns(versionsTarFile, hnsDomain, { format: "tar" });
      // Untar to versions dir.
      console.log(`Untarring '${versionsTarFile}' -> '${versionsDir}'`);
      const writer = tar.extract(versionsDir, {
        // Make sure all existing subfiles are readable.
        readable: true,
      });
      await new Promise((resolve, reject) => {
        fs.createReadStream(versionsTarFile).pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      // Delete tar file.
      fs.unlinkSync(versionsTarFile);
    } catch (error) {
      // If there was any error, stop. The initial directory should be uploaded manually.
      console.log(error);
      return;
    }
  }

  // Copy the web bundle to the appropriate version dir.

  // Compute the destination dir.
  // TODO: Index by major version?
  let versionSubdir = version.split(".").slice(0, 2).join(".");
  const suffix = version.split("-").slice(1);
  if (suffix.length > 0) {
    versionSubdir = `${versionSubdir}-${suffix}`;
  }
  const destinationDir = `${versionsDir}/${versionSubdir}`;

  // Copy the bundle. destination will be created or overwritten.
  console.log(`Copying '${bundlePath}' -> '${destinationDir}'`);
  if (fs.existsSync(destinationDir)) {
    fs.rmSync(destinationDir, { recursive: true });
  }
  fs.mkdirSync(destinationDir, { recursive: true });
  fse.copySync(bundlePath, destinationDir);

  // Upload the directory and get the skylink.

  if (!skipUpload) {
    console.log(`Uploading '${versionsDir}' dir`);
    let skylink = await client.uploadDirectory(versionsDir, { disableDefaultPath: true });
    skylink = skylink.slice(uriSkynetPrefix.length);
    console.log(`Skylink: ${skylink}`);

    // Delete versionsDir.
    fs.rmSync(versionsDir, { recursive: true });

    // Update the registry entry.

    console.log(`Updating '${dataKey}' registry entry with skylink`);
    const { publicKey, privateKey } = genKeyPairFromSeed(seed);
    const { entry } = await client.registry.getEntry(publicKey, dataKey);
    await client.registry.setEntry(privateKey, {
      dataKey,
      data: stringToUint8ArrayUtf8(skylink),
      revision: entry.revision + BigInt(1),
    });

    // Print the resolver skylink.

    const resolverSkylink = await client.registry.getEntryLink(publicKey, dataKey);
    console.log(`Resolver skylink: ${resolverSkylink}`);
  }
})();
