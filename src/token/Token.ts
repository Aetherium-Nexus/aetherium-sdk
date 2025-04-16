/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { MsgTransferEncodeObject } from "@cosmjs/stargate";

import {
  Address,
  Numberish,
  ProtocolType,
  assert,
  eqAddress,
} from "@aetherium-nexus/utils";

import { ChainMetadata } from "../metadata/chainMetadataTypes.js";
import { MultiProtocolProvider } from "../providers/MultiProtocolProvider.js";
import { ChainName } from "../types.js";

import type { IToken, TokenArgs } from "./IToken.js";
import { TokenAmount } from "./TokenAmount.js";
import { TokenConnection, TokenConnectionType } from "./TokenConnection.js";
import {
  PROTOCOL_TO_NATIVE_STANDARD,
  TOKEN_COLLATERALIZED_STANDARDS,
  TOKEN_AET_STANDARDS,
  TOKEN_MULTI_CHAIN_STANDARDS,
  TOKEN_NFT_STANDARDS,
  TOKEN_STANDARD_TO_PROTOCOL,
  TokenStandard,
  XERC20_STANDARDS,
} from "./TokenStandard.js";
import {
  CwAetCollateralAdapter,
  CwAetNativeAdapter,
  CwAetSyntheticAdapter,
  CwNativeTokenAdapter,
  CwTokenAdapter,
} from "./adapters/CosmWasmTokenAdapter.js";
import {
  CosmIbcToWarpTokenAdapter,
  CosmIbcTokenAdapter,
  CosmNativeTokenAdapter,
} from "./adapters/CosmosTokenAdapter.js";
import {
  EvmAetCollateralAdapter,
  EvmAetCollateralFiatAdapter,
  EvmAetNativeAdapter,
  EvmAetSyntheticAdapter,
  EvmAetXERC20Adapter,
  EvmAetXERC20LockboxAdapter,
  EvmNativeTokenAdapter,
  EvmTokenAdapter,
} from "./adapters/EvmTokenAdapter.js";
import type {
  IAetTokenAdapter,
  ITokenAdapter,
} from "./adapters/ITokenAdapter.js";
import {
  SealevelAetCollateralAdapter,
  SealevelAetNativeAdapter,
  SealevelAetSyntheticAdapter,
  SealevelNativeTokenAdapter,
  SealevelTokenAdapter,
} from "./adapters/SealevelTokenAdapter.js";
import { PROTOCOL_TO_DEFAULT_NATIVE_TOKEN } from "./nativeTokenMetadata.js";

// Declaring the interface in addition to class allows
// Typescript to infer the members vars from TokenArgs
export interface Token extends TokenArgs {}

export class Token implements IToken {
  public readonly protocol: ProtocolType;

  constructor(args: TokenArgs) {
    Object.assign(this, args);
    this.protocol = TOKEN_STANDARD_TO_PROTOCOL[this.standard];
  }

  /**
   * Creates a Token for the native currency on the given chain.
   * Will use the default native token for the given protocol if
   * nothing specific is set in the ChainMetadata.
   */
  static FromChainMetadataNativeToken(chainMetadata: ChainMetadata): Token {
    const { protocol, name: chainName, logoURI } = chainMetadata;
    const nativeToken =
      chainMetadata.nativeToken || PROTOCOL_TO_DEFAULT_NATIVE_TOKEN[protocol];

    return new Token({
      chainName,
      standard: PROTOCOL_TO_NATIVE_STANDARD[protocol],
      addressOrDenom: nativeToken.denom ?? "",
      decimals: nativeToken.decimals,
      symbol: nativeToken.symbol,
      name: nativeToken.name,
      logoURI,
    });
  }

  /**
   * Returns a TokenAdapter for the token and multiProvider
   * @throws If multiProvider does not contain this token's chain.
   * @throws If token is an NFT (TODO NFT Adapter support)
   */
  getAdapter(multiProvider: MultiProtocolProvider): ITokenAdapter<unknown> {
    const { standard, chainName, addressOrDenom } = this;

    assert(!this.isNft(), "NFT adapters not yet supported");
    assert(
      multiProvider.tryGetChainMetadata(chainName),
      `Token chain ${chainName} not found in multiProvider`
    );

    if (standard === TokenStandard.ERC20) {
      return new EvmTokenAdapter(chainName, multiProvider, {
        token: addressOrDenom,
      });
    } else if (standard === TokenStandard.EvmNative) {
      return new EvmNativeTokenAdapter(chainName, multiProvider, {});
    } else if (standard === TokenStandard.SealevelSpl) {
      return new SealevelTokenAdapter(
        chainName,
        multiProvider,
        { token: addressOrDenom },
        false
      );
    } else if (standard === TokenStandard.SealevelSpl2022) {
      return new SealevelTokenAdapter(
        chainName,
        multiProvider,
        { token: addressOrDenom },
        true
      );
    } else if (standard === TokenStandard.SealevelNative) {
      return new SealevelNativeTokenAdapter(chainName, multiProvider, {});
    } else if (standard === TokenStandard.CosmosIcs20) {
      throw new Error("Cosmos ICS20 token adapter not yet supported");
    } else if (standard === TokenStandard.CosmosNative) {
      return new CosmNativeTokenAdapter(
        chainName,
        multiProvider,
        {},
        { ibcDenom: addressOrDenom }
      );
    } else if (standard === TokenStandard.CW20) {
      return new CwTokenAdapter(chainName, multiProvider, {
        token: addressOrDenom,
      });
    } else if (standard === TokenStandard.CWNative) {
      return new CwNativeTokenAdapter(
        chainName,
        multiProvider,
        {},
        addressOrDenom
      );
    } else if (this.isAetToken()) {
      return this.getAetAdapter(multiProvider);
    } else if (this.isIbcToken()) {
      // Passing in a stub connection here because it's not required
      // for an IBC adapter to fulfill the ITokenAdapter interface
      return this.getIbcAdapter(multiProvider, {
        token: this,
        sourcePort: "transfer",
        sourceChannel: "channel-0",
        type: TokenConnectionType.Ibc,
      });
    } else {
      throw new Error(`No adapter found for token standard: ${standard}`);
    }
  }

  /**
   * Returns a AetTokenAdapter for the token and multiProvider
   * @throws If not applicable to this token's standard.
   * @throws If multiProvider does not contain this token's chain.
   * @throws If token is an NFT (TODO NFT Adapter support)
   */
  getAetAdapter(
    multiProvider: MultiProtocolProvider<{ mailbox?: Address }>,
    destination?: ChainName
  ): IAetTokenAdapter<unknown> {
    const { standard, chainName, addressOrDenom, collateralAddressOrDenom } =
      this;
    const chainMetadata = multiProvider.tryGetChainMetadata(chainName);
    const mailbox = chainMetadata?.mailbox;

    assert(
      this.isMultiChainToken(),
      `Token standard ${standard} not applicable to aet adapter`
    );
    assert(!this.isNft(), "NFT adapters not yet supported");
    assert(
      chainMetadata,
      `Token chain ${chainName} not found in multiProvider`
    );

    if (standard === TokenStandard.EvmAetNative) {
      return new EvmAetNativeAdapter(chainName, multiProvider, {
        token: addressOrDenom,
      });
    } else if (
      standard === TokenStandard.EvmAetCollateral ||
      standard === TokenStandard.EvmAetOwnerCollateral ||
      standard === TokenStandard.EvmAetRebaseCollateral
    ) {
      return new EvmAetCollateralAdapter(chainName, multiProvider, {
        token: addressOrDenom,
      });
    } else if (standard === TokenStandard.EvmAetCollateralFiat) {
      return new EvmAetCollateralFiatAdapter(chainName, multiProvider, {
        token: addressOrDenom,
      });
    } else if (
      standard === TokenStandard.EvmAetSynthetic ||
      standard === TokenStandard.EvmAetSyntheticRebase
    ) {
      return new EvmAetSyntheticAdapter(chainName, multiProvider, {
        token: addressOrDenom,
      });
    } else if (
      standard === TokenStandard.EvmAetXERC20 ||
      standard === TokenStandard.EvmAetVSXERC20
    ) {
      return new EvmAetXERC20Adapter(chainName, multiProvider, {
        token: addressOrDenom,
      });
    } else if (
      standard === TokenStandard.EvmAetXERC20Lockbox ||
      standard === TokenStandard.EvmAetVSXERC20Lockbox
    ) {
      return new EvmAetXERC20LockboxAdapter(chainName, multiProvider, {
        token: addressOrDenom,
      });
    } else if (standard === TokenStandard.SealevelAetNative) {
      assert(mailbox, `Mailbox required for Sealevel aet tokens`);
      return new SealevelAetNativeAdapter(
        chainName,
        multiProvider,
        {
          warpRouter: addressOrDenom,
          mailbox,
        },
        false
      );
    } else if (standard === TokenStandard.SealevelAetCollateral) {
      assert(mailbox, `Mailbox required for Sealevel aet tokens`);
      assert(
        collateralAddressOrDenom,
        `collateralAddressOrDenom required for Sealevel aet collateral tokens`
      );
      return new SealevelAetCollateralAdapter(
        chainName,
        multiProvider,
        {
          warpRouter: addressOrDenom,
          token: collateralAddressOrDenom,
          mailbox,
        },
        false
      );
    } else if (standard === TokenStandard.SealevelAetSynthetic) {
      assert(mailbox, `Mailbox required for Sealevel aet tokens`);
      assert(
        collateralAddressOrDenom,
        `collateralAddressOrDenom required for Sealevel aet synthetic tokens`
      );
      return new SealevelAetSyntheticAdapter(
        chainName,
        multiProvider,
        {
          warpRouter: addressOrDenom,
          token: collateralAddressOrDenom,
          mailbox,
        },
        false
      );
    } else if (standard === TokenStandard.CwAetNative) {
      return new CwAetNativeAdapter(chainName, multiProvider, {
        warpRouter: addressOrDenom,
      });
    } else if (standard === TokenStandard.CwAetCollateral) {
      assert(
        collateralAddressOrDenom,
        "collateralAddressOrDenom required for CwAetCollateral"
      );
      return new CwAetCollateralAdapter(chainName, multiProvider, {
        warpRouter: addressOrDenom,
        token: collateralAddressOrDenom,
      });
    } else if (standard === TokenStandard.CwAetSynthetic) {
      assert(
        collateralAddressOrDenom,
        "collateralAddressOrDenom required for CwAetSyntheticAdapter"
      );
      return new CwAetSyntheticAdapter(chainName, multiProvider, {
        warpRouter: addressOrDenom,
        token: collateralAddressOrDenom,
      });
    } else if (standard === TokenStandard.CosmosIbc) {
      assert(destination, "destination required for IBC token adapters");
      const connection = this.getConnectionForChain(destination);
      assert(connection, `No connection found for chain ${destination}`);
      return this.getIbcAdapter(multiProvider, connection);
    } else {
      throw new Error(`No aet adapter found for token standard: ${standard}`);
    }
  }

  protected getIbcAdapter(
    multiProvider: MultiProtocolProvider,
    connection: TokenConnection
  ): IAetTokenAdapter<MsgTransferEncodeObject> {
    if (connection.type === TokenConnectionType.Ibc) {
      const { sourcePort, sourceChannel } = connection;
      return new CosmIbcTokenAdapter(
        this.chainName,
        multiProvider,
        {},
        { ibcDenom: this.addressOrDenom, sourcePort, sourceChannel }
      );
    } else if (connection.type === TokenConnectionType.IbcAetherium) {
      const {
        sourcePort,
        sourceChannel,
        intermediateChainName,
        intermediateIbcDenom,
        intermediateRouterAddress,
      } = connection;
      const destinationRouterAddress = connection.token.addressOrDenom;
      return new CosmIbcToWarpTokenAdapter(
        this.chainName,
        multiProvider,
        {
          intermediateRouterAddress,
          destinationRouterAddress,
        },
        {
          ibcDenom: this.addressOrDenom,
          sourcePort,
          sourceChannel,
          intermediateIbcDenom,
          intermediateChainName,
        }
      );
    } else {
      throw new Error(`Unsupported IBC connection type: ${connection.type}`);
    }
  }

  /**
   * Convenience method to create an adapter and return an account balance
   */
  async getBalance(
    multiProvider: MultiProtocolProvider,
    address: Address
  ): Promise<TokenAmount> {
    const adapter = this.getAdapter(multiProvider);
    const balance = await adapter.getBalance(address);
    return new TokenAmount(balance, this);
  }

  amount(amount: Numberish): TokenAmount {
    return new TokenAmount(amount, this);
  }

  isNft(): boolean {
    return TOKEN_NFT_STANDARDS.includes(this.standard);
  }

  isNative(): boolean {
    return Object.values(PROTOCOL_TO_NATIVE_STANDARD).includes(this.standard);
  }

  isCollateralized(): boolean {
    return TOKEN_COLLATERALIZED_STANDARDS.includes(this.standard);
  }

  isAetToken(): boolean {
    return TOKEN_AET_STANDARDS.includes(this.standard);
  }

  isXerc20(): boolean {
    return XERC20_STANDARDS.includes(this.standard);
  }

  isIbcToken(): boolean {
    return this.standard === TokenStandard.CosmosIbc;
  }

  isMultiChainToken(): boolean {
    return TOKEN_MULTI_CHAIN_STANDARDS.includes(this.standard);
  }

  getConnections(): TokenConnection[] {
    return this.connections || [];
  }

  getConnectionForChain(chain: ChainName): TokenConnection | undefined {
    // A token cannot have > 1 connected token for the same chain
    return this.getConnections().filter((t) => t.token.chainName === chain)[0];
  }

  addConnection(connection: TokenConnection): Token {
    this.connections = [...(this.connections || []), connection];
    return this;
  }

  removeConnection(token: IToken): Token {
    const index = this.connections?.findIndex((t) => t.token.equals(token));
    if (index && index >= 0) this.connections?.splice(index, 1);
    return this;
  }

  /**
   * Returns true if tokens refer to the same asset
   */
  equals(token?: IToken): boolean {
    if (!token) return false;
    return (
      this.protocol === token.protocol &&
      this.chainName === token.chainName &&
      this.standard === token.standard &&
      this.decimals === token.decimals &&
      this.addressOrDenom.toLowerCase() ===
        token.addressOrDenom.toLowerCase() &&
      this.collateralAddressOrDenom?.toLowerCase() ===
        token.collateralAddressOrDenom?.toLowerCase()
    );
  }

  /**
   * Two tokens may not be equal but may still represent the same underlying asset
   * The cases for this include:
   *   1) A AetCollateral contract token and its wrapped token (eg. EvmAetCollateral and ERC20)
   *   2) A AetNative contract and its native currency (eg. EvmAetNative and Ether)
   *   3) An IBC token and its native equivalent
   * This is useful during fee estimation to determine if a TokenAmount for the transfer and the fee
   * are actually fungible (represent the same asset).
   * @returns true if the tokens represent the same underlying asset
   */
  isFungibleWith(token?: IToken): boolean {
    if (!token || token.chainName !== this.chainName) return false;

    if (this.equals(token)) return true;

    if (this.isCollateralized()) {
      if (
        this.collateralAddressOrDenom &&
        eqAddress(this.collateralAddressOrDenom, token.addressOrDenom)
      ) {
        return true;
      }

      if (!this.collateralAddressOrDenom && token.isNative()) {
        return true;
      }
    }

    if (
      this.standard === TokenStandard.CosmosIbc &&
      token.standard === TokenStandard.CosmosNative &&
      this.addressOrDenom.toLowerCase() === token.addressOrDenom.toLowerCase()
    ) {
      return true;
    }

    return false;
  }
}
