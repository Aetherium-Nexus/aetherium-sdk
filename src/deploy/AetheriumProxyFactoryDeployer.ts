import { rootLogger } from '@aetherium-nexus/utils';

import { AetheriumContracts } from '../contracts/types.js';
import { MultiProvider } from '../providers/MultiProvider.js';
import { ChainName } from '../types.js';

import { AetheriumDeployer } from './AetheriumDeployer.js';
import {
  ProxyFactoryFactories,
  proxyFactoryFactories,
  proxyFactoryImplementations,
} from './contracts.js';
import { ContractVerifier } from './verify/ContractVerifier.js';

export class AetheriumProxyFactoryDeployer extends AetheriumDeployer<
  {},
  ProxyFactoryFactories
> {
  constructor(
    multiProvider: MultiProvider,
    contractVerifier?: ContractVerifier,
    concurrentDeploy: boolean = false,
  ) {
    super(multiProvider, proxyFactoryFactories, {
      logger: rootLogger.child({ module: 'IsmFactoryDeployer' }),
      contractVerifier,
      concurrentDeploy,
    });
  }

  async deployContracts(
    chain: ChainName,
  ): Promise<AetheriumContracts<ProxyFactoryFactories>> {
    const contracts: any = {};
    for (const factoryName of Object.keys(
      this.factories,
    ) as (keyof ProxyFactoryFactories)[]) {
      const factory = await this.deployContract(chain, factoryName, []);
      this.addVerificationArtifacts(chain, [
        {
          name: proxyFactoryImplementations[factoryName],
          address: await factory.implementation(),
          constructorArguments: '',
          isProxy: true,
        },
      ]);
      contracts[factoryName] = factory;
    }
    return contracts as AetheriumContracts<ProxyFactoryFactories>;
  }
}
