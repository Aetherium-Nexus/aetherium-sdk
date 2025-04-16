import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers.js";
import { expect } from "chai";
import { ethers } from "ethers";
import hre from "hardhat";

import {
  ERC20Test,
  ERC20Test__factory,
  ProxyAdmin,
  ProxyAdmin__factory,
  TransparentUpgradeableProxy__factory,
  XERC20Test,
  XERC20Test__factory,
} from "@aetherium-nexus/core";
import { Address, objMap } from "@aetherium-nexus/utils";

import { TestChainName } from "../consts/testChains.js";
import { TestCoreApp } from "../core/TestCoreApp.js";
import { TestCoreDeployer } from "../core/TestCoreDeployer.js";
import { AetheriumProxyFactoryDeployer } from "../deploy/AetheriumProxyFactoryDeployer.js";
import { ViolationType } from "../deploy/types.js";
import { AetheriumIsmFactory } from "../ism/AetheriumIsmFactory.js";
import { MultiProvider } from "../providers/MultiProvider.js";

import { EvmERC20WarpRouteReader } from "./EvmERC20WarpRouteReader.js";
import { AetERC20App } from "./app.js";
import { AetERC20Checker } from "./checker.js";
import { TokenType } from "./config.js";
import { AetERC20Deployer } from "./deploy.js";
import {
  AetTokenRouterConfig,
  WarpRouteDeployConfigMailboxRequired,
} from "./types.js";

const chain = TestChainName.test1;

describe("TokenDeployer", async () => {
  let signer: SignerWithAddress;
  let deployer: AetERC20Deployer;
  let multiProvider: MultiProvider;
  let coreApp: TestCoreApp;
  let config: WarpRouteDeployConfigMailboxRequired;
  let token: Address;
  let xerc20: XERC20Test;
  let erc20: ERC20Test;
  let admin: ProxyAdmin;
  const totalSupply = "100000";

  before(async () => {
    [signer] = await hre.ethers.getSigners();
    multiProvider = MultiProvider.createTestMultiProvider({ signer });
    const ismFactoryDeployer = new AetheriumProxyFactoryDeployer(multiProvider);
    const factories = await ismFactoryDeployer.deploy(
      multiProvider.mapKnownChains(() => ({}))
    );
    const ismFactory = new AetheriumIsmFactory(factories, multiProvider);
    coreApp = await new TestCoreDeployer(multiProvider, ismFactory).deployApp();
    const routerConfigMap = coreApp.getRouterConfig(signer.address);
    config = objMap(
      routerConfigMap,
      (chain, c): AetTokenRouterConfig => ({
        type: TokenType.synthetic,
        name: chain,
        symbol: `u${chain}`,
        decimals: 18,
        ...c,
      })
    );
  });

  beforeEach(async () => {
    const { name, decimals, symbol } = config[chain];
    const implementation = await new XERC20Test__factory(signer).deploy(
      name!,
      symbol!,
      totalSupply!,
      decimals!
    );
    admin = await new ProxyAdmin__factory(signer).deploy();
    const proxy = await new TransparentUpgradeableProxy__factory(signer).deploy(
      implementation.address,
      admin.address,
      XERC20Test__factory.createInterface().encodeFunctionData("initialize")
    );
    token = proxy.address;
    xerc20 = XERC20Test__factory.connect(token, signer);
    erc20 = await new ERC20Test__factory(signer).deploy(
      name!,
      symbol!,
      totalSupply!,
      decimals!
    );

    deployer = new AetERC20Deployer(multiProvider);
  });

  it("deploys", async () => {
    await deployer.deploy(config);
  });

  for (const type of [
    TokenType.collateral,
    TokenType.synthetic,
    TokenType.XERC20,
  ]) {
    const token = () => {
      switch (type) {
        case TokenType.XERC20:
          return xerc20.address;
        case TokenType.collateral:
          return erc20.address;
        default:
          return undefined;
      }
    };

    describe("AetERC20Checker", async () => {
      let checker: AetERC20Checker;

      beforeEach(async () => {
        config[chain] = {
          ...config[chain],
          type,
          // @ts-ignore
          token: token(),
        };

        const contractsMap = await deployer.deploy(config);
        const app = new AetERC20App(contractsMap, multiProvider);
        checker = new AetERC20Checker(multiProvider, app, config);
      });

      it(`should have no violations on clean deploy of ${type}`, async () => {
        await checker.check();
        checker.expectEmpty();
      });

      it(`should check owner of collateral`, async () => {
        if (type !== TokenType.XERC20) {
          return;
        }

        await xerc20.transferOwnership(ethers.Wallet.createRandom().address);
        await checker.check();
        checker.expectViolations({
          [ViolationType.Owner]: 1,
        });
      });

      it(`should check owner of collateral proxyAdmin`, async () => {
        if (type !== TokenType.XERC20) {
          return;
        }

        await admin.transferOwnership(ethers.Wallet.createRandom().address);
        await checker.check();
        checker.expectViolations({
          [ViolationType.Owner]: 1,
        });
      });
    });

    describe("ERC20WarpRouterReader", async () => {
      let reader: EvmERC20WarpRouteReader;
      let routerAddress: Address;

      before(() => {
        reader = new EvmERC20WarpRouteReader(
          multiProvider,
          TestChainName.test1
        );
      });

      beforeEach(async () => {
        config[chain] = {
          ...config[chain],
          type,
          // @ts-ignore
          token: token(),
        };
        const warpRoute = await deployer.deploy(config);
        routerAddress = warpRoute[chain][type].address;
      });

      it(`should derive AetTokenRouterConfig correctly`, async () => {
        const derivedConfig = await reader.deriveWarpRouteConfig(routerAddress);
        expect(derivedConfig.type).to.equal(config[chain].type);
      });
    });
  }
});
