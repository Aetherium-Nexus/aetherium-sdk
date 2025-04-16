import { Logger } from "pino";

import { TokenRouter } from "@aetherium-nexus/core";
import { Address, objKeys } from "@aetherium-nexus/utils";

import { appFromAddressesMapHelper } from "../contracts/contracts.js";
import {
  AetheriumAddressesMap,
  AetheriumContracts,
  AetheriumContractsMap,
} from "../contracts/types.js";
import { MultiProvider } from "../providers/MultiProvider.js";
import { GasRouterApp } from "../router/RouterApps.js";
import { ProxiedFactories, proxiedFactories } from "../router/types.js";
import { ChainMap } from "../types.js";

import { AetERC20Factories, aetERC20factories } from "./contracts.js";

export class AetERC20App extends GasRouterApp<
  AetERC20Factories & ProxiedFactories,
  TokenRouter
> {
  constructor(
    contractsMap: AetheriumContractsMap<AetERC20Factories & ProxiedFactories>,
    multiProvider: MultiProvider,
    logger?: Logger,
    foreignDeployments: ChainMap<Address> = {}
  ) {
    super(contractsMap, multiProvider, logger, foreignDeployments);
  }

  router(contracts: AetheriumContracts<AetERC20Factories>): TokenRouter {
    for (const key of objKeys(aetERC20factories)) {
      if (contracts[key]) {
        return contracts[key] as unknown as TokenRouter;
      }
    }
    throw new Error("No router found in contracts");
  }

  static fromAddressesMap(
    addressesMap: AetheriumAddressesMap<AetERC20Factories & ProxiedFactories>,
    multiProvider: MultiProvider
  ): AetERC20App {
    const helper = appFromAddressesMapHelper(
      addressesMap,
      { ...aetERC20factories, ...proxiedFactories },
      multiProvider
    );
    return new AetERC20App(helper.contractsMap, helper.multiProvider);
  }
}
