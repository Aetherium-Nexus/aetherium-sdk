import { constants } from "ethers";

import {
  ERC20__factory,
  ERC721Enumerable__factory,
  GasRouter,
  IERC4626__factory,
  IXERC20Lockbox__factory,
} from "@aetherium-nexus/core";
import {
  ProtocolType,
  assert,
  objKeys,
  objMap,
  rootLogger,
} from "@aetherium-nexus/utils";

import { AetheriumContracts } from "../contracts/types.js";
import { ContractVerifier } from "../deploy/verify/ContractVerifier.js";
import { AetheriumIsmFactory } from "../ism/AetheriumIsmFactory.js";
import { MultiProvider } from "../providers/MultiProvider.js";
import { GasRouterDeployer } from "../router/GasRouterDeployer.js";
import { ChainName } from "../types.js";

import { TokenType, gasOverhead } from "./config.js";
import {
  AetERC20Factories,
  AetERC721Factories,
  TokenFactories,
  aetERC20contracts,
  aetERC20factories,
  aetERC721contracts,
  aetERC721factories,
} from "./contracts.js";
import {
  AetTokenRouterConfig,
  TokenMetadata,
  TokenMetadataSchema,
  WarpRouteDeployConfig,
  WarpRouteDeployConfigMailboxRequired,
  isCollateralTokenConfig,
  isNativeTokenConfig,
  isSyntheticRebaseTokenConfig,
  isSyntheticTokenConfig,
  isTokenMetadata,
  isXERC20TokenConfig,
} from "./types.js";

abstract class TokenDeployer<
  Factories extends TokenFactories
> extends GasRouterDeployer<AetTokenRouterConfig, Factories> {
  constructor(
    multiProvider: MultiProvider,
    factories: Factories,
    loggerName: string,
    ismFactory?: AetheriumIsmFactory,
    contractVerifier?: ContractVerifier,
    concurrentDeploy = false
  ) {
    super(multiProvider, factories, {
      logger: rootLogger.child({ module: loggerName }),
      ismFactory,
      contractVerifier,
      concurrentDeploy,
    }); // factories not used in deploy
  }

  async constructorArgs(
    _: ChainName,
    config: AetTokenRouterConfig
  ): Promise<any> {
    const scale = config.scale ?? 1;

    if (isCollateralTokenConfig(config) || isXERC20TokenConfig(config)) {
      return [config.token, scale, config.mailbox];
    } else if (isNativeTokenConfig(config)) {
      return [scale, config.mailbox];
    } else if (isSyntheticTokenConfig(config)) {
      assert(config.decimals, "decimals is undefined for config"); // decimals must be defined by this point
      return [config.decimals, scale, config.mailbox];
    } else if (isSyntheticRebaseTokenConfig(config)) {
      const collateralDomain = this.multiProvider.getDomainId(
        config.collateralChainName
      );
      return [config.decimals, scale, config.mailbox, collateralDomain];
    } else {
      throw new Error("Unknown token type when constructing arguments");
    }
  }

  async initializeArgs(
    chain: ChainName,
    config: AetTokenRouterConfig
  ): Promise<any> {
    const signer = await this.multiProvider.getSigner(chain).getAddress();
    const defaultArgs = [
      config.hook ?? constants.AddressZero,
      config.interchainSecurityModule ?? constants.AddressZero,
      // TransferOwnership will happen later in RouterDeployer
      signer,
    ];
    if (
      isCollateralTokenConfig(config) ||
      isXERC20TokenConfig(config) ||
      isNativeTokenConfig(config)
    ) {
      return defaultArgs;
    } else if (isSyntheticTokenConfig(config)) {
      return [
        config.initialSupply ?? 0,
        config.name,
        config.symbol,
        ...defaultArgs,
      ];
    } else if (isSyntheticRebaseTokenConfig(config)) {
      return [0, config.name, config.symbol, ...defaultArgs];
    } else {
      throw new Error("Unknown collateral type when initializing arguments");
    }
  }

  static async deriveTokenMetadata(
    multiProvider: MultiProvider,
    configMap: WarpRouteDeployConfig
  ): Promise<TokenMetadata | undefined> {
    for (const [chain, config] of Object.entries(configMap)) {
      if (isTokenMetadata(config)) {
        return TokenMetadataSchema.parse(config);
      } else if (multiProvider.getProtocol(chain) !== ProtocolType.Ethereum) {
        // If the config didn't specify the token metadata, we can only now
        // derive it for Ethereum chains. So here we skip non-Ethereum chains.
        continue;
      }

      if (isNativeTokenConfig(config)) {
        const nativeToken = multiProvider.getChainMetadata(chain).nativeToken;
        if (nativeToken) {
          return TokenMetadataSchema.parse({
            ...nativeToken,
          });
        }
      }

      if (isCollateralTokenConfig(config) || isXERC20TokenConfig(config)) {
        const provider = multiProvider.getProvider(chain);

        if (config.isNft) {
          const erc721 = ERC721Enumerable__factory.connect(
            config.token,
            provider
          );
          const [name, symbol] = await Promise.all([
            erc721.name(),
            erc721.symbol(),
          ]);
          return TokenMetadataSchema.parse({
            name,
            symbol,
          });
        }

        let token: string;
        switch (config.type) {
          case TokenType.XERC20Lockbox:
            token = await IXERC20Lockbox__factory.connect(
              config.token,
              provider
            ).callStatic.ERC20();
            break;
          case TokenType.collateralVault:
            token = await IERC4626__factory.connect(
              config.token,
              provider
            ).callStatic.asset();
            break;
          default:
            token = config.token;
            break;
        }

        const erc20 = ERC20__factory.connect(token, provider);
        const [name, symbol, decimals] = await Promise.all([
          erc20.name(),
          erc20.symbol(),
          erc20.decimals(),
        ]);

        return TokenMetadataSchema.parse({
          name,
          symbol,
          decimals,
        });
      }
    }

    return undefined;
  }

  async deploy(configMap: WarpRouteDeployConfigMailboxRequired) {
    let tokenMetadata: TokenMetadata | undefined;
    try {
      tokenMetadata = await TokenDeployer.deriveTokenMetadata(
        this.multiProvider,
        configMap
      );
    } catch (err) {
      this.logger.error("Failed to derive token metadata", err, configMap);
      throw err;
    }

    const resolvedConfigMap = objMap(configMap, (_, config) => ({
      ...tokenMetadata,
      gas: gasOverhead(config.type),
      ...config,
    }));
    return super.deploy(resolvedConfigMap);
  }
}

export class AetERC20Deployer extends TokenDeployer<AetERC20Factories> {
  constructor(
    multiProvider: MultiProvider,
    ismFactory?: AetheriumIsmFactory,
    contractVerifier?: ContractVerifier,
    concurrentDeploy = false
  ) {
    super(
      multiProvider,
      aetERC20factories,
      "AetERC20Deployer",
      ismFactory,
      contractVerifier,
      concurrentDeploy
    );
  }

  router(contracts: AetheriumContracts<AetERC20Factories>): GasRouter {
    for (const key of objKeys(aetERC20factories)) {
      if (contracts[key]) {
        return contracts[key];
      }
    }
    throw new Error("No matching contract found");
  }

  routerContractKey(config: AetTokenRouterConfig): keyof AetERC20Factories {
    assert(config.type in aetERC20factories, "Invalid ERC20 token type");
    return config.type as keyof AetERC20Factories;
  }

  routerContractName(config: AetTokenRouterConfig): string {
    return aetERC20contracts[this.routerContractKey(config)];
  }
}

export class AetERC721Deployer extends TokenDeployer<AetERC721Factories> {
  constructor(
    multiProvider: MultiProvider,
    ismFactory?: AetheriumIsmFactory,
    contractVerifier?: ContractVerifier
  ) {
    super(
      multiProvider,
      aetERC721factories,
      "AetERC721Deployer",
      ismFactory,
      contractVerifier
    );
  }

  router(contracts: AetheriumContracts<AetERC721Factories>): GasRouter {
    for (const key of objKeys(aetERC721factories)) {
      if (contracts[key]) {
        return contracts[key];
      }
    }
    throw new Error("No matching contract found");
  }

  routerContractKey(config: AetTokenRouterConfig): keyof AetERC721Factories {
    assert(config.type in aetERC721factories, "Invalid ERC721 token type");
    return config.type as keyof AetERC721Factories;
  }

  routerContractName(config: AetTokenRouterConfig): string {
    return aetERC721contracts[this.routerContractKey(config)];
  }
}
