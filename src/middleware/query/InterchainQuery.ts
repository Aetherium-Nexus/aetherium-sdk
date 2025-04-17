import { InterchainQueryRouter } from "@aetherium-nexus/core";

import { appFromAddressesMapHelper } from "../../contracts/contracts.js";
import {
  AetheriumAddressesMap,
  AetheriumContracts,
} from "../../contracts/types.js";
import { MultiProvider } from "../../providers/MultiProvider.js";
import { RouterApp } from "../../router/RouterApps.js";

import {
  InterchainQueryFactories,
  interchainQueryFactories,
} from "./contracts.js";

export class InterchainQuery extends RouterApp<InterchainQueryFactories> {
  router(
    contracts: AetheriumContracts<InterchainQueryFactories>
  ): InterchainQueryRouter {
    return contracts.interchainQueryRouter;
  }

  static fromAddressesMap(
    addressesMap: AetheriumAddressesMap<any>,
    multiProvider: MultiProvider
  ): InterchainQuery {
    const helper = appFromAddressesMapHelper(
      addressesMap,
      interchainQueryFactories,
      multiProvider
    );
    return new InterchainQuery(helper.contractsMap, helper.multiProvider);
  }
}
