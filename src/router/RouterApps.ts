import type { BigNumber } from "ethers";
import { Logger } from "pino";

import { GasRouter, Router } from "@aetherium-nexus/core";
import {
  Address,
  ProtocolType,
  objMap,
  promiseObjAll,
} from "@aetherium-nexus/utils";

import { AetheriumApp } from "../app/AetheriumApp.js";
import {
  AetheriumContracts,
  AetheriumContractsMap,
  AetheriumFactories,
} from "../contracts/types.js";
import { MultiProvider } from "../providers/MultiProvider.js";
import { ChainMap, ChainName } from "../types.js";

export abstract class RouterApp<
  Factories extends AetheriumFactories
> extends AetheriumApp<Factories> {
  constructor(
    contractsMap: AetheriumContractsMap<Factories>,
    multiProvider: MultiProvider,
    logger?: Logger,
    readonly foreignDeployments: ChainMap<Address> = {}
  ) {
    super(contractsMap, multiProvider, logger);
  }

  abstract router(contracts: AetheriumContracts<Factories>): Router;

  routerAddress(chainName: string): Address {
    if (
      this.multiProvider.getChainMetadata(chainName).protocol ===
      ProtocolType.Ethereum
    ) {
      return this.router(this.contractsMap[chainName]).address;
    }
    return this.foreignDeployments[chainName];
  }

  // check onchain for remote enrollments
  override async remoteChains(chainName: string): Promise<ChainName[]> {
    const router = this.router(this.contractsMap[chainName]);
    const onchainRemoteChainNames = (await router.domains()).map((domain) => {
      const chainName = this.multiProvider.tryGetChainName(domain);
      if (chainName === null) {
        throw new Error(`Chain name not found for domain: ${domain}`);
      }
      return chainName;
    });
    return onchainRemoteChainNames;
  }

  getSecurityModules(): Promise<ChainMap<Address>> {
    return promiseObjAll(
      objMap(this.chainMap, (_, contracts) =>
        this.router(contracts).interchainSecurityModule()
      )
    );
  }

  getOwners(): Promise<ChainMap<Address>> {
    return promiseObjAll(
      objMap(this.chainMap, (_, contracts) => this.router(contracts).owner())
    );
  }
}

export abstract class GasRouterApp<
  Factories extends AetheriumFactories,
  R extends GasRouter
> extends RouterApp<Factories> {
  abstract router(contracts: AetheriumContracts<Factories>): R;

  async quoteGasPayment(
    origin: ChainName,
    destination: ChainName
  ): Promise<BigNumber> {
    return this.getContracts(origin).router.quoteGasPayment(
      this.multiProvider.getDomainId(destination)
    );
  }
}
