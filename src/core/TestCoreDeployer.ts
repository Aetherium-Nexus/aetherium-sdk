import { testChains } from "../consts/testChains.js";
import { AetheriumContracts } from "../contracts/types.js";
import { testCoreConfig } from "../test/testUtils.js";
import { ChainMap } from "../types.js";

import { AetheriumCoreDeployer } from "./AetheriumCoreDeployer.js";
import { TestCoreApp } from "./TestCoreApp.js";
import { CoreFactories } from "./contracts.js";

export class TestCoreDeployer extends AetheriumCoreDeployer {
  async deploy(): Promise<ChainMap<AetheriumContracts<CoreFactories>>> {
    return super.deploy(testCoreConfig(testChains));
  }

  async deployApp(): Promise<TestCoreApp> {
    return new TestCoreApp(await this.deploy(), this.multiProvider);
  }
}
