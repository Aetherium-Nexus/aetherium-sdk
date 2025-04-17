import { objMap, rootLogger } from "@aetherium-nexus/utils";

import {
  connectContracts,
  serializeContracts,
} from "../contracts/contracts.js";
import {
  AetheriumAddresses,
  AetheriumContracts,
  AetheriumContractsMap,
  AetheriumFactories,
} from "../contracts/types.js";
import { MultiProvider } from "../providers/MultiProvider.js";
import { ChainName } from "../types.js";
import { MultiGeneric } from "../utils/MultiGeneric.js";

export class AetheriumApp<
  Factories extends AetheriumFactories
> extends MultiGeneric<AetheriumContracts<Factories>> {
  public readonly contractsMap: AetheriumContractsMap<Factories>;

  constructor(
    contractsMap: AetheriumContractsMap<Factories>,
    public readonly multiProvider: MultiProvider,
    public readonly logger = rootLogger.child({ module: "App" })
  ) {
    const connectedContractsMap = objMap(contractsMap, (chain, contracts) =>
      connectContracts(contracts, multiProvider.getSignerOrProvider(chain))
    );
    super(connectedContractsMap);
    this.contractsMap = connectedContractsMap;
  }

  getContracts(chain: ChainName): AetheriumContracts<Factories> {
    return this.get(chain);
  }

  getAddresses(chain: ChainName): AetheriumAddresses<Factories> {
    return serializeContracts(this.get(chain));
  }
}
