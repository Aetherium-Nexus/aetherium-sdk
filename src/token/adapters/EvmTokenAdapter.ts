import { BigNumber, PopulatedTransaction } from "ethers";

import {
  ERC20,
  ERC20__factory,
  AetERC20,
  AetERC20Collateral,
  AetERC20Collateral__factory,
  AetERC20__factory,
  AetXERC20,
  AetXERC20Lockbox,
  AetXERC20Lockbox__factory,
  AetXERC20__factory,
  IXERC20,
  IXERC20VS,
  IXERC20VS__factory,
  IXERC20__factory,
} from "@aetherium-nexus/core";
import {
  Address,
  Domain,
  Numberish,
  addressToByteHexString,
  addressToBytes32,
  bytes32ToAddress,
  strip0x,
} from "@aetherium-nexus/utils";

import { BaseEvmAdapter } from "../../app/MultiProtocolApp.js";
import { MultiProtocolProvider } from "../../providers/MultiProtocolProvider.js";
import { ChainName } from "../../types.js";
import { TokenMetadata } from "../types.js";

import {
  IAetTokenAdapter,
  IAetVSXERC20Adapter,
  IAetXERC20Adapter,
  ITokenAdapter,
  IXERC20VSAdapter,
  InterchainGasQuote,
  RateLimitMidPoint,
  TransferParams,
  TransferRemoteParams,
} from "./ITokenAdapter.js";

// An estimate of the gas amount for a typical EVM token router transferRemote transaction
// Computed by estimating on a few different chains, taking the max, and then adding ~50% padding
export const EVM_TRANSFER_REMOTE_GAS_ESTIMATE = 450_000n;

// Interacts with native currencies
export class EvmNativeTokenAdapter
  extends BaseEvmAdapter
  implements ITokenAdapter<PopulatedTransaction>
{
  async getBalance(address: Address): Promise<bigint> {
    const balance = await this.getProvider().getBalance(address);
    return BigInt(balance.toString());
  }

  async getMetadata(): Promise<TokenMetadata> {
    // TODO get metadata from chainMetadata config
    throw new Error("Metadata not available to native tokens");
  }

  async getMinimumTransferAmount(_recipient: Address): Promise<bigint> {
    return 0n;
  }

  async isApproveRequired(
    _owner: Address,
    _spender: Address,
    _weiAmountOrId: Numberish
  ): Promise<boolean> {
    return false;
  }

  async populateApproveTx(
    _params: TransferParams
  ): Promise<PopulatedTransaction> {
    throw new Error("Approve not required for native tokens");
  }

  async populateTransferTx({
    weiAmountOrId,
    recipient,
  }: TransferParams): Promise<PopulatedTransaction> {
    const value = BigNumber.from(weiAmountOrId.toString());
    return { value, to: recipient };
  }

  async getTotalSupply(): Promise<bigint | undefined> {
    // Not implemented, native tokens don't have an accessible total supply
    return undefined;
  }
}

// Interacts with ERC20/721 contracts
export class EvmTokenAdapter<T extends ERC20 = ERC20>
  extends EvmNativeTokenAdapter
  implements ITokenAdapter<PopulatedTransaction>
{
  public readonly contract: T;

  constructor(
    public readonly chainName: ChainName,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: { token: Address },
    public readonly contractFactory: any = ERC20__factory
  ) {
    super(chainName, multiProvider, addresses);
    this.contract = contractFactory.connect(
      addresses.token,
      this.getProvider()
    );
  }

  override async getBalance(address: Address): Promise<bigint> {
    const balance = await this.contract.balanceOf(address);
    return BigInt(balance.toString());
  }

  override async getMetadata(isNft?: boolean): Promise<TokenMetadata> {
    const [decimals, symbol, name] = await Promise.all([
      isNft ? 0 : this.contract.decimals(),
      this.contract.symbol(),
      this.contract.name(),
    ]);
    return { decimals, symbol, name };
  }

  override async isApproveRequired(
    owner: Address,
    spender: Address,
    weiAmountOrId: Numberish
  ): Promise<boolean> {
    const allowance = await this.contract.allowance(owner, spender);
    return allowance.lt(weiAmountOrId);
  }

  override populateApproveTx({
    weiAmountOrId,
    recipient,
  }: TransferParams): Promise<PopulatedTransaction> {
    return this.contract.populateTransaction.approve(
      recipient,
      weiAmountOrId.toString()
    );
  }

  override populateTransferTx({
    weiAmountOrId,
    recipient,
  }: TransferParams): Promise<PopulatedTransaction> {
    return this.contract.populateTransaction.transfer(
      recipient,
      weiAmountOrId.toString()
    );
  }

  async getTotalSupply(): Promise<bigint> {
    const totalSupply = await this.contract.totalSupply();
    return totalSupply.toBigInt();
  }
}

// Interacts with Aet Synthetic token contracts (aka 'AetTokens')
export class EvmAetSyntheticAdapter
  extends EvmTokenAdapter<AetERC20>
  implements IAetTokenAdapter<PopulatedTransaction>
{
  constructor(
    public readonly chainName: ChainName,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: { token: Address },
    public readonly contractFactory: any = AetERC20__factory
  ) {
    super(chainName, multiProvider, addresses, contractFactory);
  }

  override async isApproveRequired(
    _owner: Address,
    _spender: Address,
    _weiAmountOrId: Numberish
  ): Promise<boolean> {
    return false;
  }

  getDomains(): Promise<Domain[]> {
    return this.contract.domains();
  }

  async getRouterAddress(domain: Domain): Promise<Buffer> {
    const routerAddressesAsBytes32 = await this.contract.routers(domain);
    // Evm addresses will be padded with 12 bytes
    if (routerAddressesAsBytes32.startsWith("0x000000000000000000000000")) {
      return Buffer.from(
        strip0x(bytes32ToAddress(routerAddressesAsBytes32)),
        "hex"
      );
      // Otherwise leave the address unchanged
    } else {
      return Buffer.from(strip0x(routerAddressesAsBytes32), "hex");
    }
  }

  async getAllRouters(): Promise<Array<{ domain: Domain; address: Buffer }>> {
    const domains = await this.getDomains();
    const routers: Buffer[] = await Promise.all(
      domains.map((d) => this.getRouterAddress(d))
    );
    return domains.map((d, i) => ({ domain: d, address: routers[i] }));
  }

  getBridgedSupply(): Promise<bigint | undefined> {
    return this.getTotalSupply();
  }

  async quoteTransferRemoteGas(
    destination: Domain
  ): Promise<InterchainGasQuote> {
    const gasPayment = await this.contract.quoteGasPayment(destination);
    // If EVM aet contracts eventually support alternative IGP tokens,
    // this would need to determine the correct token address
    return { amount: BigInt(gasPayment.toString()) };
  }

  async populateTransferRemoteTx({
    weiAmountOrId,
    destination,
    recipient,
    interchainGas,
  }: TransferRemoteParams): Promise<PopulatedTransaction> {
    if (!interchainGas)
      interchainGas = await this.quoteTransferRemoteGas(destination);

    const recipBytes32 = addressToBytes32(addressToByteHexString(recipient));
    return this.contract.populateTransaction[
      "transferRemote(uint32,bytes32,uint256)"
    ](destination, recipBytes32, weiAmountOrId, {
      value: interchainGas.amount.toString(),
    });
  }
}

// Interacts with AetCollateral contracts
export class EvmAetCollateralAdapter
  extends EvmAetSyntheticAdapter
  implements IAetTokenAdapter<PopulatedTransaction>
{
  public readonly collateralContract: AetERC20Collateral;
  protected wrappedTokenAddress?: Address;

  constructor(
    public readonly chainName: ChainName,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: { token: Address }
  ) {
    super(chainName, multiProvider, addresses);
    this.collateralContract = AetERC20Collateral__factory.connect(
      addresses.token,
      this.getProvider()
    );
  }

  protected async getWrappedTokenAddress(): Promise<Address> {
    if (!this.wrappedTokenAddress) {
      this.wrappedTokenAddress = await this.collateralContract.wrappedToken();
    }
    return this.wrappedTokenAddress!;
  }

  protected async getWrappedTokenAdapter(): Promise<EvmTokenAdapter> {
    return new EvmTokenAdapter(this.chainName, this.multiProvider, {
      token: await this.getWrappedTokenAddress(),
    });
  }

  override getBridgedSupply(): Promise<bigint | undefined> {
    return this.getBalance(this.addresses.token);
  }

  override getMetadata(isNft?: boolean): Promise<TokenMetadata> {
    return this.getWrappedTokenAdapter().then((t) => t.getMetadata(isNft));
  }

  override isApproveRequired(
    owner: Address,
    spender: Address,
    weiAmountOrId: Numberish
  ): Promise<boolean> {
    return this.getWrappedTokenAdapter().then((t) =>
      t.isApproveRequired(owner, spender, weiAmountOrId)
    );
  }

  override populateApproveTx(
    params: TransferParams
  ): Promise<PopulatedTransaction> {
    return this.getWrappedTokenAdapter().then((t) =>
      t.populateApproveTx(params)
    );
  }

  override populateTransferTx(
    params: TransferParams
  ): Promise<PopulatedTransaction> {
    return this.getWrappedTokenAdapter().then((t) =>
      t.populateTransferTx(params)
    );
  }
}

export class EvmAetCollateralFiatAdapter
  extends EvmAetCollateralAdapter
  implements IAetTokenAdapter<PopulatedTransaction>
{
  /**
   * Note this may be inaccurate, as this returns the total supply
   * of the fiat token, which may be used by other bridges.
   * However this is the best we can do with a simple view call.
   */
  override async getBridgedSupply(): Promise<bigint> {
    const wrapped = await this.getWrappedTokenAdapter();
    return wrapped.getTotalSupply();
  }
}

abstract class BaseEvmAetXERC20Adapter<X extends IXERC20 | IXERC20VS>
  extends EvmAetCollateralAdapter
  implements IAetXERC20Adapter<PopulatedTransaction>
{
  public readonly aetXERC20: AetXERC20;

  constructor(
    public readonly chainName: ChainName,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: { token: Address }
  ) {
    super(chainName, multiProvider, addresses);
    this.aetXERC20 = AetXERC20__factory.connect(
      addresses.token,
      this.getProvider()
    );
  }

  protected abstract connectXERC20(xerc20Addr: Address): X;

  async getXERC20(): Promise<X> {
    const xerc20Addr = await this.aetXERC20.wrappedToken();
    return this.connectXERC20(xerc20Addr);
  }

  override async getBridgedSupply(): Promise<bigint> {
    const xerc20 = await this.getXERC20();
    // Both IXERC20 and IXERC20VS have totalSupply, name, etc. if they extend ERC20
    const totalSupply = await xerc20.totalSupply();
    return totalSupply.toBigInt();
  }

  async getMintLimit(): Promise<bigint> {
    const xerc20 = await this.getXERC20();
    const limit = await xerc20.mintingCurrentLimitOf(this.contract.address);
    return limit.toBigInt();
  }

  async getMintMaxLimit(): Promise<bigint> {
    const xerc20 = await this.getXERC20();
    const limit = await xerc20.mintingMaxLimitOf(this.contract.address);
    return limit.toBigInt();
  }

  async getBurnLimit(): Promise<bigint> {
    const xerc20 = await this.getXERC20();
    const limit = await xerc20.burningCurrentLimitOf(this.contract.address);
    return limit.toBigInt();
  }

  async getBurnMaxLimit(): Promise<bigint> {
    const xerc20 = await this.getXERC20();
    const limit = await xerc20.burningMaxLimitOf(this.contract.address);
    return limit.toBigInt();
  }
}

abstract class BaseEvmAetXERC20LockboxAdapter<X extends IXERC20 | IXERC20VS>
  extends EvmAetCollateralAdapter
  implements IAetXERC20Adapter<PopulatedTransaction>
{
  protected readonly aetXERC20Lockbox: AetXERC20Lockbox;

  constructor(
    public readonly chainName: ChainName,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: { token: Address }
  ) {
    super(chainName, multiProvider, addresses);

    this.aetXERC20Lockbox = AetXERC20Lockbox__factory.connect(
      addresses.token,
      this.getProvider()
    );
  }

  /**
   * Note this may be inaccurate, as this returns the balance
   * of the lockbox contract, which may be used by other bridges.
   * However this is the best we can do with a simple view call.
   */
  override async getBridgedSupply(): Promise<bigint> {
    const lockboxAddress = await this.aetXERC20Lockbox.lockbox();
    return this.getBalance(lockboxAddress);
  }

  async getXERC20(): Promise<X> {
    const xERC20Addr = await this.aetXERC20Lockbox.xERC20();
    return this.connectXERC20(xERC20Addr);
  }

  protected abstract connectXERC20(xERC20Addr: Address): X;

  async getMintLimit(): Promise<bigint> {
    const xERC20 = await this.getXERC20();
    const limit = await xERC20.mintingCurrentLimitOf(this.contract.address);
    return limit.toBigInt();
  }

  async getMintMaxLimit(): Promise<bigint> {
    const xERC20 = await this.getXERC20();
    const limit = await xERC20.mintingMaxLimitOf(this.contract.address);
    return limit.toBigInt();
  }

  async getBurnLimit(): Promise<bigint> {
    const xERC20 = await this.getXERC20();
    const limit = await xERC20.burningCurrentLimitOf(this.contract.address);
    return limit.toBigInt();
  }

  async getBurnMaxLimit(): Promise<bigint> {
    const xERC20 = await this.getXERC20();
    const limit = await xERC20.burningMaxLimitOf(this.contract.address);
    return limit.toBigInt();
  }
}

// Interacts with AetXERC20Lockbox contracts
export class EvmAetXERC20LockboxAdapter extends BaseEvmAetXERC20LockboxAdapter<IXERC20> {
  protected connectXERC20(xERC20Addr: Address): IXERC20 {
    return IXERC20__factory.connect(xERC20Addr, this.getProvider());
  }
}

export class EvmAetVSXERC20LockboxAdapter
  extends BaseEvmAetXERC20LockboxAdapter<IXERC20VS>
  implements IAetVSXERC20Adapter<PopulatedTransaction>
{
  protected connectXERC20(xERC20Addr: Address): IXERC20VS {
    return IXERC20VS__factory.connect(xERC20Addr, this.getProvider());
  }

  // If you need to expose rate-limiting calls or other VS-specific logic:
  async getRateLimits(): Promise<RateLimitMidPoint> {
    const xERC20 = await this.getXERC20();
    const rateLimits = await xERC20.rateLimits(this.contract.address);

    return {
      rateLimitPerSecond: BigInt(rateLimits.rateLimitPerSecond.toString()),
      bufferCap: BigInt(rateLimits.bufferCap.toString()),
      lastBufferUsedTime: Number(rateLimits.lastBufferUsedTime),
      bufferStored: BigInt(rateLimits.bufferStored.toString()),
      midPoint: BigInt(rateLimits.midPoint.toString()),
    };
  }
  async populateSetBufferCapTx(
    newBufferCap: bigint
  ): Promise<PopulatedTransaction> {
    const xERC20 = await this.getXERC20();
    return xERC20.populateTransaction.setBufferCap(
      this.addresses.token,
      newBufferCap
    );
  }

  async populateSetRateLimitPerSecondTx(
    newRateLimitPerSecond: bigint
  ): Promise<PopulatedTransaction> {
    const xERC20 = await this.getXERC20();
    return xERC20.populateTransaction.setRateLimitPerSecond(
      this.addresses.token,
      newRateLimitPerSecond
    );
  }

  async populateAddBridgeTx(
    bufferCap: bigint,
    rateLimitPerSecond: bigint
  ): Promise<PopulatedTransaction> {
    const xERC20 = await this.getXERC20();
    return xERC20.populateTransaction.addBridge({
      bufferCap,
      rateLimitPerSecond,
      bridge: this.addresses.token,
    });
  }
}

// Interacts with AetXERC20 contracts
export class EvmAetXERC20Adapter extends BaseEvmAetXERC20Adapter<IXERC20> {
  protected connectXERC20(xerc20Addr: string): IXERC20 {
    return IXERC20__factory.connect(xerc20Addr, this.getProvider());
  }
}

export class EvmAetVSXERC20Adapter
  extends BaseEvmAetXERC20Adapter<IXERC20VS>
  implements IAetVSXERC20Adapter<PopulatedTransaction>
{
  protected connectXERC20(xerc20Addr: string): IXERC20VS {
    return IXERC20VS__factory.connect(xerc20Addr, this.getProvider());
  }

  async getRateLimits(): Promise<RateLimitMidPoint> {
    const xERC20 = await this.getXERC20();
    const rateLimits = await xERC20.rateLimits(this.contract.address);

    return {
      rateLimitPerSecond: BigInt(rateLimits.rateLimitPerSecond.toString()),
      bufferCap: BigInt(rateLimits.bufferCap.toString()),
      lastBufferUsedTime: Number(rateLimits.lastBufferUsedTime),
      bufferStored: BigInt(rateLimits.bufferStored.toString()),
      midPoint: BigInt(rateLimits.midPoint.toString()),
    };
  }

  async populateSetBufferCapTx(
    newBufferCap: bigint
  ): Promise<PopulatedTransaction> {
    const xERC20 = await this.getXERC20();
    return xERC20.populateTransaction.setBufferCap(
      this.addresses.token,
      newBufferCap
    );
  }

  async populateSetRateLimitPerSecondTx(
    newRateLimitPerSecond: bigint
  ): Promise<PopulatedTransaction> {
    const xERC20 = await this.getXERC20();
    return xERC20.populateTransaction.setRateLimitPerSecond(
      this.addresses.token,
      newRateLimitPerSecond
    );
  }

  async populateAddBridgeTx(
    bufferCap: bigint,
    rateLimitPerSecond: bigint
  ): Promise<PopulatedTransaction> {
    const xERC20 = await this.getXERC20();
    return xERC20.populateTransaction.addBridge({
      bufferCap,
      rateLimitPerSecond,
      bridge: this.addresses.token,
    });
  }
}

// Interacts AetNative contracts
export class EvmAetNativeAdapter
  extends EvmAetCollateralAdapter
  implements IAetTokenAdapter<PopulatedTransaction>
{
  override async isApproveRequired(): Promise<boolean> {
    return false;
  }

  override async populateTransferRemoteTx({
    weiAmountOrId,
    destination,
    recipient,
    interchainGas,
  }: TransferRemoteParams): Promise<PopulatedTransaction> {
    if (!interchainGas)
      interchainGas = await this.quoteTransferRemoteGas(destination);

    let txValue: bigint | undefined = undefined;
    const { addressOrDenom: igpAddressOrDenom, amount: igpAmount } =
      interchainGas;
    // If the igp token is native Eth
    if (!igpAddressOrDenom) {
      txValue = igpAmount + BigInt(weiAmountOrId);
    } else {
      txValue = igpAmount;
    }

    const recipBytes32 = addressToBytes32(addressToByteHexString(recipient));
    return this.contract.populateTransaction[
      "transferRemote(uint32,bytes32,uint256)"
    ](destination, recipBytes32, weiAmountOrId, { value: txValue?.toString() });
  }
}

export class EvmXERC20VSAdapter
  extends EvmTokenAdapter
  implements IXERC20VSAdapter<PopulatedTransaction>
{
  xERC20VS: IXERC20VS;

  constructor(
    public readonly chainName: ChainName,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: { token: Address }
  ) {
    super(chainName, multiProvider, addresses);

    this.xERC20VS = IXERC20VS__factory.connect(
      addresses.token,
      this.getProvider()
    );
  }

  async getRateLimits(bridge: Address): Promise<RateLimitMidPoint> {
    const result = await this.xERC20VS.rateLimits(bridge);

    const rateLimits: RateLimitMidPoint = {
      rateLimitPerSecond: BigInt(result.rateLimitPerSecond.toString()),
      bufferCap: BigInt(result.bufferCap.toString()),
      lastBufferUsedTime: Number(result.lastBufferUsedTime),
      bufferStored: BigInt(result.bufferStored.toString()),
      midPoint: BigInt(result.midPoint.toString()),
    };

    return rateLimits;
  }

  // remove bridge
  async populateRemoveBridgeTx(bridge: Address): Promise<PopulatedTransaction> {
    return this.xERC20VS.populateTransaction.removeBridge(bridge);
  }

  async populateSetBufferCapTx(
    bridge: Address,
    newBufferCap: bigint
  ): Promise<PopulatedTransaction> {
    return this.xERC20VS.populateTransaction.setBufferCap(
      bridge,
      newBufferCap.toString()
    );
  }

  async populateSetRateLimitPerSecondTx(
    bridge: Address,
    newRateLimitPerSecond: bigint
  ): Promise<PopulatedTransaction> {
    return this.xERC20VS.populateTransaction.setRateLimitPerSecond(
      bridge,
      newRateLimitPerSecond.toString()
    );
  }

  async populateAddBridgeTx(
    bufferCap: bigint,
    rateLimitPerSecond: bigint,
    bridge: Address
  ): Promise<PopulatedTransaction> {
    return this.xERC20VS.populateTransaction.addBridge({
      bufferCap: bufferCap.toString(),
      rateLimitPerSecond: rateLimitPerSecond.toString(),
      bridge,
    });
  }
}
