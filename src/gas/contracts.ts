import {
  InterchainGasPaymaster__factory,
  ProxyAdmin__factory,
  StorageGasOracle__factory,
} from "@aetherium-nexus/core";

export const igpFactories = {
  interchainGasPaymaster: new InterchainGasPaymaster__factory(),
  storageGasOracle: new StorageGasOracle__factory(),
  proxyAdmin: new ProxyAdmin__factory(),
};

export type IgpFactories = typeof igpFactories;
