import { ProtocolType, objMap } from "@aetherium-nexus/utils";

import {
  PROTOCOL_TO_DEFAULT_PROVIDER_TYPE,
  ProviderType,
} from "../providers/ProviderType.js";

import { TokenType } from "./config.js";

export enum TokenStandard {
  // EVM
  ERC20 = "ERC20",
  ERC721 = "ERC721",
  EvmNative = "EvmNative",
  EvmAetNative = "EvmAetNative",
  EvmAetCollateral = "EvmAetCollateral",
  EvmAetOwnerCollateral = "EvmAetOwnerCollateral",
  EvmAetRebaseCollateral = "EvmAetRebaseCollateral",
  EvmAetCollateralFiat = "EvmAetCollateralFiat",
  EvmAetSynthetic = "EvmAetSynthetic",
  EvmAetSyntheticRebase = "EvmAetSyntheticRebase",
  EvmAetXERC20 = "EvmAetXERC20",
  EvmAetXERC20Lockbox = "EvmAetXERC20Lockbox",
  EvmAetVSXERC20 = "EvmAetVSXERC20",
  EvmAetVSXERC20Lockbox = "EvmAetVSXERC20Lockbox",

  // Sealevel (Solana)
  SealevelSpl = "SealevelSpl",
  SealevelSpl2022 = "SealevelSpl2022",
  SealevelNative = "SealevelNative",
  SealevelAetNative = "SealevelAetNative",
  SealevelAetCollateral = "SealevelAetCollateral",
  SealevelAetSynthetic = "SealevelAetSynthetic",

  // Cosmos
  CosmosIcs20 = "CosmosIcs20",
  CosmosIcs721 = "CosmosIcs721",
  CosmosNative = "CosmosNative",
  CosmosIbc = "CosmosIbc",

  // CosmWasm
  CW20 = "CW20",
  CWNative = "CWNative",
  CW721 = "CW721",
  CwAetNative = "CwAetNative",
  CwAetCollateral = "CwAetCollateral",
  CwAetSynthetic = "CwAetSynthetic",

  //Starknet
  StarknetAetNative = "StarknetAetNative",
  StarknetAetCollateral = "StarknetAetCollateral",
  StarknetAetSynthetic = "StarknetAetSynthetic",
}

// Allows for omission of protocol field in token args
export const TOKEN_STANDARD_TO_PROTOCOL: Record<TokenStandard, ProtocolType> = {
  // EVM
  ERC20: ProtocolType.Ethereum,
  ERC721: ProtocolType.Ethereum,
  EvmNative: ProtocolType.Ethereum,
  EvmAetNative: ProtocolType.Ethereum,
  EvmAetCollateral: ProtocolType.Ethereum,
  EvmAetOwnerCollateral: ProtocolType.Ethereum,
  EvmAetRebaseCollateral: ProtocolType.Ethereum,
  EvmAetCollateralFiat: ProtocolType.Ethereum,
  EvmAetSynthetic: ProtocolType.Ethereum,
  EvmAetSyntheticRebase: ProtocolType.Ethereum,
  EvmAetXERC20: ProtocolType.Ethereum,
  EvmAetXERC20Lockbox: ProtocolType.Ethereum,
  EvmAetVSXERC20: ProtocolType.Ethereum,
  EvmAetVSXERC20Lockbox: ProtocolType.Ethereum,

  // Sealevel (Solana)
  SealevelSpl: ProtocolType.Sealevel,
  SealevelSpl2022: ProtocolType.Sealevel,
  SealevelNative: ProtocolType.Sealevel,
  SealevelAetNative: ProtocolType.Sealevel,
  SealevelAetCollateral: ProtocolType.Sealevel,
  SealevelAetSynthetic: ProtocolType.Sealevel,

  // Cosmos
  CosmosIcs20: ProtocolType.Cosmos,
  CosmosIcs721: ProtocolType.Cosmos,
  CosmosNative: ProtocolType.Cosmos,
  CosmosIbc: ProtocolType.Cosmos,

  // CosmWasm
  CW20: ProtocolType.Cosmos,
  CWNative: ProtocolType.Cosmos,
  CW721: ProtocolType.Cosmos,
  CwAetNative: ProtocolType.Cosmos,
  CwAetCollateral: ProtocolType.Cosmos,
  CwAetSynthetic: ProtocolType.Cosmos,

  // Starknet
  StarknetAetCollateral: ProtocolType.Starknet,
  StarknetAetNative: ProtocolType.Starknet,
  StarknetAetSynthetic: ProtocolType.Starknet,
};

export const TOKEN_STANDARD_TO_PROVIDER_TYPE: Record<
  TokenStandard,
  ProviderType
> = objMap(TOKEN_STANDARD_TO_PROTOCOL, (k, v) => {
  if (k.startsWith("Cosmos")) return ProviderType.CosmJs;
  return PROTOCOL_TO_DEFAULT_PROVIDER_TYPE[v];
});

export const TOKEN_NFT_STANDARDS = [
  TokenStandard.ERC721,
  TokenStandard.CosmosIcs721,
  TokenStandard.CW721,
  // TODO solana here
];

export const TOKEN_COLLATERALIZED_STANDARDS = [
  TokenStandard.EvmAetCollateral,
  TokenStandard.EvmAetNative,
  TokenStandard.SealevelAetCollateral,
  TokenStandard.SealevelAetNative,
  TokenStandard.CwAetCollateral,
  TokenStandard.CwAetNative,
  TokenStandard.EvmAetXERC20Lockbox,
  TokenStandard.EvmAetVSXERC20Lockbox,
];

export const XERC20_STANDARDS = [
  TokenStandard.EvmAetXERC20,
  TokenStandard.EvmAetXERC20Lockbox,
  TokenStandard.EvmAetVSXERC20,
  TokenStandard.EvmAetVSXERC20Lockbox,
];

export const MINT_LIMITED_STANDARDS = [
  TokenStandard.EvmAetXERC20,
  TokenStandard.EvmAetXERC20Lockbox,
  TokenStandard.EvmAetVSXERC20,
  TokenStandard.EvmAetVSXERC20Lockbox,
];

export const TOKEN_AET_STANDARDS = [
  TokenStandard.EvmAetNative,
  TokenStandard.EvmAetCollateral,
  TokenStandard.EvmAetCollateralFiat,
  TokenStandard.EvmAetOwnerCollateral,
  TokenStandard.EvmAetRebaseCollateral,
  TokenStandard.EvmAetSynthetic,
  TokenStandard.EvmAetSyntheticRebase,
  TokenStandard.EvmAetXERC20,
  TokenStandard.EvmAetXERC20Lockbox,
  TokenStandard.EvmAetVSXERC20,
  TokenStandard.EvmAetVSXERC20Lockbox,
  TokenStandard.SealevelAetNative,
  TokenStandard.SealevelAetCollateral,
  TokenStandard.SealevelAetSynthetic,
  TokenStandard.CwAetNative,
  TokenStandard.CwAetCollateral,
  TokenStandard.CwAetSynthetic,
  TokenStandard.StarknetAetNative,
  TokenStandard.StarknetAetCollateral,
  TokenStandard.StarknetAetSynthetic,
];

export const TOKEN_MULTI_CHAIN_STANDARDS = [
  ...TOKEN_AET_STANDARDS,
  TokenStandard.CosmosIbc,
];

// Useful for differentiating from norma Cosmos standards
// (e.g. for determining the appropriate cosmos client)
export const TOKEN_COSMWASM_STANDARDS = [
  TokenStandard.CW20,
  TokenStandard.CWNative,
  TokenStandard.CW721,
  TokenStandard.CwAetNative,
  TokenStandard.CwAetCollateral,
  TokenStandard.CwAetSynthetic,
];

export const TOKEN_TYPE_TO_STANDARD: Record<TokenType, TokenStandard> = {
  [TokenType.native]: TokenStandard.EvmAetNative,
  [TokenType.collateral]: TokenStandard.EvmAetCollateral,
  [TokenType.collateralFiat]: TokenStandard.EvmAetCollateralFiat,
  [TokenType.XERC20]: TokenStandard.EvmAetXERC20,
  [TokenType.XERC20Lockbox]: TokenStandard.EvmAetXERC20Lockbox,
  [TokenType.collateralVault]: TokenStandard.EvmAetOwnerCollateral,
  [TokenType.collateralVaultRebase]: TokenStandard.EvmAetRebaseCollateral,
  [TokenType.collateralUri]: TokenStandard.EvmAetCollateral,
  [TokenType.fastCollateral]: TokenStandard.EvmAetCollateral,
  [TokenType.synthetic]: TokenStandard.EvmAetSynthetic,
  [TokenType.syntheticRebase]: TokenStandard.EvmAetSyntheticRebase,
  [TokenType.syntheticUri]: TokenStandard.EvmAetSynthetic,
  [TokenType.fastSynthetic]: TokenStandard.EvmAetSynthetic,
  [TokenType.nativeScaled]: TokenStandard.EvmAetNative,
};

// Starknet supported token types
export const STARKNET_SUPPORTED_TOKEN_TYPES = [
  TokenType.collateral,
  TokenType.native,
  TokenType.synthetic,
] as const;

type StarknetSupportedTokenTypes =
  (typeof STARKNET_SUPPORTED_TOKEN_TYPES)[number];

export const STARKNET_TOKEN_TYPE_TO_STANDARD: Record<
  StarknetSupportedTokenTypes,
  TokenStandard
> = {
  [TokenType.collateral]: TokenStandard.StarknetAetCollateral,
  [TokenType.native]: TokenStandard.StarknetAetNative,
  [TokenType.synthetic]: TokenStandard.StarknetAetSynthetic,
};

export const PROTOCOL_TO_NATIVE_STANDARD: Record<ProtocolType, TokenStandard> =
  {
    [ProtocolType.Ethereum]: TokenStandard.EvmNative,
    [ProtocolType.Cosmos]: TokenStandard.CosmosNative,
    [ProtocolType.Sealevel]: TokenStandard.SealevelNative,
    [ProtocolType.Starknet]: TokenStandard.StarknetAetNative,
  };
