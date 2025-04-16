import { constants } from "ethers";

import { Ownable, Ownable__factory } from "@aetherium-nexus/core";
import {
  Address,
  EvmChainId,
  ProtocolType,
  ValueOf,
  eqAddress,
  hexOrBase58ToHex,
  objFilter,
  objMap,
  pick,
  rootLogger,
} from "@aetherium-nexus/utils";

import { ChainMetadataManager } from "../metadata/ChainMetadataManager.js";
import { MultiProvider } from "../providers/MultiProvider.js";
import { AnnotatedEV5Transaction } from "../providers/ProviderType.js";
import { ChainMap, Connection, OwnableConfig } from "../types.js";

import {
  AetheriumAddresses,
  AetheriumAddressesMap,
  AetheriumContracts,
  AetheriumContractsMap,
  AetheriumFactories,
} from "./types.js";

export function serializeContractsMap<F extends AetheriumFactories>(
  contractsMap: AetheriumContractsMap<F>
): AetheriumAddressesMap<F> {
  return objMap(contractsMap, (_, contracts) => {
    return serializeContracts(contracts);
  });
}

export function serializeContracts<F extends AetheriumFactories>(
  contracts: AetheriumContracts<F>
): any {
  return objMap(contracts, (_, contract) =>
    contract.address ? contract.address : serializeContracts(contract)
  );
}

function getFactory<F extends AetheriumFactories>(
  key: keyof F,
  factories: F
): ValueOf<F> {
  if (!(key in factories)) {
    throw new Error(`Factories entry missing for ${key.toString()}`);
  }
  return factories[key];
}

export function filterAddressesMap<F extends AetheriumFactories>(
  addressesMap: AetheriumAddressesMap<any>,
  factories: F
): AetheriumAddressesMap<F> {
  const factoryKeys = Object.keys(factories);
  // Filter out addresses that we do not have factories for
  const pickedAddressesMap = objMap(addressesMap, (_, addresses) =>
    pick(addresses, factoryKeys)
  );

  const chainsWithMissingAddresses = new Set<string>();
  const filledAddressesMap = objMap(
    pickedAddressesMap,
    (chainName, addresses) =>
      objMap(addresses, (key, value) => {
        if (!value) {
          rootLogger.warn(
            `Missing address for contract "${key}" on chain ${chainName}`
          );
          chainsWithMissingAddresses.add(chainName);
          return constants.AddressZero;
        }
        return value;
      })
  );
  // Add summary warning if any addresses were missing
  if (chainsWithMissingAddresses.size > 0) {
    rootLogger.warn(
      `Warning: Core deployment incomplete for chain(s): ${Array.from(
        chainsWithMissingAddresses
      ).join(", ")}. ` +
        `Please run 'core deploy' again for these chains to fix the deployment.`
    );
  }

  // Filter out chains for which we do not have a complete set of addresses
  return objFilter(
    filledAddressesMap,
    (_, addresses): addresses is AetheriumAddresses<F> => {
      return Object.keys(addresses).every((a) => factoryKeys.includes(a));
    }
  );
}

export function filterChainMapToProtocol(
  contractsMap: ChainMap<any>,
  protocolType: ProtocolType,
  metadataManager: ChainMetadataManager<any>
): ChainMap<any> {
  return objFilter(
    contractsMap,
    (c, _addrs): _addrs is any =>
      metadataManager.tryGetChainMetadata(c)?.protocol === protocolType
  );
}

export function filterChainMapExcludeProtocol(
  contractsMap: ChainMap<any>,
  protocolType: ProtocolType,
  metadataManager: ChainMetadataManager<any>
): ChainMap<any> {
  return objFilter(
    contractsMap,
    (c, _addrs): _addrs is any =>
      metadataManager.tryGetChainMetadata(c)?.protocol !== protocolType
  );
}

export function attachContracts<F extends AetheriumFactories>(
  addresses: AetheriumAddresses<F>,
  factories: F
): AetheriumContracts<F> {
  return objMap(addresses, (key, address: Address) => {
    const factory = getFactory(key, factories);
    return factory.attach(address) as Awaited<ReturnType<ValueOf<F>["deploy"]>>;
  });
}

export function attachContractsMap<F extends AetheriumFactories>(
  addressesMap: AetheriumAddressesMap<any>,
  factories: F
): AetheriumContractsMap<F> {
  const filteredAddressesMap = filterAddressesMap(addressesMap, factories);
  return objMap(filteredAddressesMap, (_, addresses) =>
    attachContracts(addresses, factories)
  ) as AetheriumContractsMap<F>;
}

export function attachContractsMapAndGetForeignDeployments<
  F extends AetheriumFactories
>(
  addressesMap: AetheriumAddressesMap<any>,
  factories: F,
  metadataManager: ChainMetadataManager<any>
): {
  contractsMap: AetheriumContractsMap<F>;
  foreignDeployments: ChainMap<Address>;
} {
  const contractsMap = attachContractsMap(
    filterChainMapToProtocol(
      addressesMap,
      ProtocolType.Ethereum,
      metadataManager
    ),
    factories
  );

  // TODO: This function shouldn't need to be aware of application types like collateral / synthetic / native etc. Ideally this should work for any app, not just warp routes. is it safe to assume this is always an object containing 1 key/value pair, and that the value will always be an address?
  const foreignDeployments = objMap(
    filterChainMapExcludeProtocol(
      addressesMap,
      ProtocolType.Ethereum,
      metadataManager
    ),
    (chain, addresses) => {
      const router =
        addresses.router ||
        addresses.collateral ||
        addresses.synthetic ||
        addresses.native;
      const protocolType = metadataManager.tryGetChainMetadata(chain)?.protocol;

      if (!router || typeof router !== "string") {
        throw new Error(`Router address not found for ${chain}`);
      }

      if (!protocolType) {
        throw new Error(`Protocol type not found for ${chain}`);
      }

      switch (protocolType) {
        case ProtocolType.Ethereum:
          throw new Error("Ethereum chain should not have foreign deployments");

        case ProtocolType.Cosmos:
          return router;

        case ProtocolType.Sealevel:
          return hexOrBase58ToHex(router);

        default:
          throw new Error(`Unsupported protocol type: ${protocolType}`);
      }
    }
  );

  return {
    contractsMap,
    foreignDeployments,
  };
}

export function attachAndConnectContracts<F extends AetheriumFactories>(
  addresses: AetheriumAddresses<F>,
  factories: F,
  connection: Connection
): AetheriumContracts<F> {
  const contracts = attachContracts(addresses, factories);
  return connectContracts(contracts, connection);
}

export function connectContracts<F extends AetheriumFactories>(
  contracts: AetheriumContracts<F>,
  connection: Connection
): AetheriumContracts<F> {
  const connectedContracts = objMap(contracts, (_, contract) => {
    if (!contract.connect) {
      return undefined;
    }
    return contract.connect(connection);
  });
  return Object.fromEntries(
    Object.entries(connectedContracts).filter(([_, contract]) => !!contract)
  ) as AetheriumContracts<F>;
}

export function connectContractsMap<F extends AetheriumFactories>(
  contractsMap: ChainMap<AetheriumContracts<F>>,
  multiProvider: MultiProvider
): ChainMap<AetheriumContracts<F>> {
  return objMap(contractsMap, (chain, contracts) =>
    connectContracts(contracts, multiProvider.getSignerOrProvider(chain))
  );
}

// NOTE: does not perform any onchain checks
export function filterOwnableContracts(contracts: AetheriumContracts<any>): {
  [key: string]: Ownable;
} {
  return objFilter(
    contracts,
    (_, contract): contract is Ownable => "owner" in contract.functions
  );
}

export function appFromAddressesMapHelper<F extends AetheriumFactories>(
  addressesMap: AetheriumAddressesMap<any>,
  factories: F,
  multiProvider: MultiProvider
): {
  contractsMap: AetheriumContractsMap<F>;
  multiProvider: MultiProvider;
} {
  // Filter out non-Ethereum chains from the addressesMap
  const ethereumAddressesMap = objFilter(
    addressesMap,
    (chain, _): _ is AetheriumAddresses<F> =>
      multiProvider.getProtocol(chain) === ProtocolType.Ethereum
  );

  // Attaches contracts for each Ethereum chain for which we have a complete set of addresses
  const contractsMap = attachContractsMap(ethereumAddressesMap, factories);

  // Filters out providers for chains for which we don't have a complete set
  // of addresses
  const intersection = multiProvider.intersect(Object.keys(contractsMap));

  // Filters out contracts for chains for which we don't have a provider
  const filteredContractsMap = pick(contractsMap, intersection.intersection);

  return {
    contractsMap: filteredContractsMap,
    multiProvider,
  };
}

export function transferOwnershipTransactions(
  chainId: EvmChainId,
  contract: Address,
  actual: OwnableConfig,
  expected: OwnableConfig,
  label?: string
): AnnotatedEV5Transaction[] {
  if (eqAddress(actual.owner, expected.owner)) {
    return [];
  }

  return [
    {
      chainId,
      annotation: `Transferring ownership of ${label ?? contract} from ${
        actual.owner
      } to ${expected.owner}`,
      to: contract,
      data: Ownable__factory.createInterface().encodeFunctionData(
        "transferOwnership",
        [expected.owner]
      ),
    },
  ];
}
