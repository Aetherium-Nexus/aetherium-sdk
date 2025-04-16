import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers.js";
import { expect } from "chai";
import { constants } from "ethers";
import hre from "hardhat";

import {
  Mailbox__factory,
  ProxyAdmin__factory,
  TestRecipient__factory,
  TimelockController__factory,
  ValidatorAnnounce__factory,
} from "@aetherium-nexus/core";
import { objMap } from "@aetherium-nexus/utils";

import { TestChainName } from "../consts/testChains.js";
import { IsmConfig, IsmType } from "../ism/types.js";
import { MultiProvider } from "../providers/MultiProvider.js";
import { AnnotatedEV5Transaction } from "../providers/ProviderType.js";
import { randomAddress, testCoreConfig } from "../test/testUtils.js";
import { normalizeConfig } from "../utils/ism.js";

import { EvmCoreModule } from "./EvmCoreModule.js";
import { CoreConfig } from "./types.js";

describe("EvmCoreModule", async () => {
  const CHAIN = TestChainName.test4;
  const DELAY = 1892391283182;
  let config: CoreConfig;
  let signer: SignerWithAddress;
  let multiProvider: MultiProvider;
  let evmCoreModule: EvmCoreModule;
  let proxyAdminContract: any;
  let mailboxContract: any;
  let validatorAnnounceContract: any;
  let testRecipientContract: any;
  let timelockControllerContract: any;
  async function sendTxs(txs: AnnotatedEV5Transaction[]) {
    for (const tx of txs) {
      await multiProvider.sendTransaction(CHAIN, tx);
    }
  }
  before(async () => {
    [signer] = await hre.ethers.getSigners();
    multiProvider = MultiProvider.createTestMultiProvider({ signer });
    config = {
      ...testCoreConfig([CHAIN])[CHAIN],
      owner: signer.address,
      upgrade: {
        timelock: {
          delay: DELAY,
          roles: {
            executor: signer.address,
            proposer: signer.address,
          },
        },
      },
    };

    evmCoreModule = await EvmCoreModule.create({
      chain: CHAIN,
      config,
      multiProvider,
    });

    const {
      proxyAdmin,
      mailbox,
      validatorAnnounce,
      testRecipient,
      timelockController,
    } = evmCoreModule.serialize();

    proxyAdminContract = ProxyAdmin__factory.connect(
      proxyAdmin!,
      multiProvider.getProvider(CHAIN)
    );

    mailboxContract = Mailbox__factory.connect(
      mailbox!,
      multiProvider.getProvider(CHAIN)
    );

    validatorAnnounceContract = ValidatorAnnounce__factory.connect(
      validatorAnnounce!,
      multiProvider.getProvider(CHAIN)
    );

    testRecipientContract = TestRecipient__factory.connect(
      testRecipient!,
      multiProvider.getProvider(CHAIN)
    );

    timelockControllerContract = TimelockController__factory.connect(
      timelockController!,
      multiProvider.getProvider(CHAIN)
    );
  });

  describe("Create", async () => {
    it("should create deploy an ICA", () => {
      const { interchainAccountRouter, interchainAccountIsm } =
        evmCoreModule.serialize();
      expect(interchainAccountIsm).to.exist;
      expect(interchainAccountRouter).to.exist;
    });

    it("should deploy ISM factories", () => {
      // Each ISM factory is a contract that is deployed by the core module
      // Ignore IGP because it's not part of the default config
      const { interchainGasPaymaster: _, ...coreContracts } =
        evmCoreModule.serialize();

      objMap(coreContracts as any, (_, address) => {
        expect(address).to.exist;
        expect(address).to.not.equal(constants.AddressZero);
      });
    });

    it("should deploy proxyAdmin", () => {
      expect(evmCoreModule.serialize().proxyAdmin).to.exist;
    });

    it("should set proxyAdmin owner to deployer", async () => {
      expect(await proxyAdminContract.owner()).to.equal(signer.address);
    });

    it("should deploy mailbox", async () => {
      const mailboxAddress = evmCoreModule.serialize().mailbox;
      expect(mailboxAddress).to.exist;

      // Check that it's actually a mailbox by calling one of it's methods
      expect(await mailboxContract.localDomain()).to.equal(
        multiProvider.getDomainId(CHAIN)
      );
    });

    it("should set mailbox owner to config owner", async () => {
      expect(await mailboxContract.owner()).to.equal(config.owner);
    });

    it("should deploy mailbox default Ism", async () => {
      expect(await mailboxContract.defaultIsm()).to.not.equal(
        constants.AddressZero
      );
    });

    it("should deploy mailbox default hook", async () => {
      expect(await mailboxContract.defaultHook()).to.not.equal(
        constants.AddressZero
      );
    });

    it("should deploy mailbox required hook", async () => {
      expect(await mailboxContract.requiredHook()).to.not.equal(
        constants.AddressZero
      );
    });

    it("should deploy validatorAnnounce", async () => {
      expect(evmCoreModule.serialize().validatorAnnounce).to.exist;
      expect(await validatorAnnounceContract.owner()).to.equal(signer.address);
    });

    it("should deploy testRecipient", async () => {
      expect(evmCoreModule.serialize().testRecipient).to.exist;
      expect(await testRecipientContract.owner()).to.equal(signer.address);
    });

    it("should deploy timelock if upgrade is set", async () => {
      expect(evmCoreModule.serialize().timelockController).to.exist;
      expect(await timelockControllerContract.getMinDelay()).to.equal(DELAY);
    });
  });

  describe("Update", async () => {
    const ismConfigToUpdate: IsmConfig[] = [
      {
        type: IsmType.TRUSTED_RELAYER,
        relayer: randomAddress(),
      },
      {
        type: IsmType.FALLBACK_ROUTING,
        owner: randomAddress(),
        domains: {},
      },
      {
        type: IsmType.PAUSABLE,
        owner: randomAddress(),
        paused: false,
      },
    ];
    it("should deploy and set a new defaultIsm", async () => {
      for (const ismConfig of ismConfigToUpdate) {
        const evmCoreModuleInstance = new EvmCoreModule(multiProvider, {
          chain: CHAIN,
          config,
          addresses: {
            ...evmCoreModule.serialize(),
          },
        });

        const expectedConfig: CoreConfig = {
          ...(await evmCoreModuleInstance.read()),
          defaultIsm: ismConfig,
        };
        await sendTxs(await evmCoreModuleInstance.update(expectedConfig));
        const updatedDefaultIsm = normalizeConfig(
          (await evmCoreModuleInstance.read()).defaultIsm
        );

        expect(updatedDefaultIsm).to.deep.equal(ismConfig);
      }
    });

    it("should not deploy and set a new Ism if the config is the same", async () => {
      const evmCoreModuleInstance = new EvmCoreModule(multiProvider, {
        chain: CHAIN,
        config,
        addresses: {
          ...evmCoreModule.serialize(),
        },
      });

      const existingConfig: CoreConfig = await evmCoreModuleInstance.read();
      const updateTxs = await evmCoreModuleInstance.update(existingConfig);

      expect(updateTxs.length).to.equal(0);
    });

    it("should update a mutable Ism", async () => {
      const evmCoreModule = await EvmCoreModule.create({
        multiProvider,
        chain: CHAIN,
        config: {
          ...config,
          defaultIsm: {
            type: IsmType.ROUTING,
            owner: signer.address,
            domains: {},
          },
        },
      });

      const defaultIsmToUpdate: IsmConfig = normalizeConfig({
        type: IsmType.ROUTING,
        owner: signer.address,
        domains: {
          test2: { type: IsmType.TEST_ISM },
        },
      });
      const updates = await evmCoreModule.update({
        ...config,
        defaultIsm: defaultIsmToUpdate,
      });

      expect(updates.length).to.equal(1);
      await sendTxs(updates);

      const latestDefaultIsmConfig = normalizeConfig(
        (await evmCoreModule.read()).defaultIsm
      );
      expect(latestDefaultIsmConfig).to.deep.equal(defaultIsmToUpdate);
    });

    it("should update the owner only if they are different", async () => {
      const evmCoreModule = await EvmCoreModule.create({
        chain: CHAIN,
        config,
        multiProvider,
      });
      const newOwner = randomAddress();
      let latestConfig = normalizeConfig(await evmCoreModule.read());
      expect(latestConfig.owner).to.not.equal(newOwner);

      await sendTxs(
        await evmCoreModule.update({
          ...config,
          owner: newOwner,
        })
      );

      latestConfig = normalizeConfig(await evmCoreModule.read());
      expect(latestConfig.owner).to.equal(newOwner);

      // No op if the same owner
      const txs = await evmCoreModule.update({
        ...config,
        owner: newOwner,
      });
      expect(txs.length).to.equal(0);
    });
  });
});
