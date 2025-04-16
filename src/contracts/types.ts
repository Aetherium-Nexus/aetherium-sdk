import type { ethers } from "ethers";

import type { Address } from "@aetherium-nexus/utils";

import type { ChainMap } from "../types.js";

export type AddressesMap = {
  [key: string]: Address;
};

export type AetheriumFactories = {
  [key: string]: ethers.ContractFactory;
};

export type AetheriumContracts<F extends AetheriumFactories> = {
  [P in keyof F]: Awaited<ReturnType<F[P]["deploy"]>>;
};

export type AetheriumContractsMap<F extends AetheriumFactories> = ChainMap<
  AetheriumContracts<F>
>;

export type AetheriumAddresses<F extends AetheriumFactories> = {
  [P in keyof F]: Address;
};

export type AetheriumAddressesMap<F extends AetheriumFactories> = ChainMap<
  AetheriumAddresses<F>
>;
