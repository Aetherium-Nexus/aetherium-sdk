import {
  FastAetERC20Collateral__factory,
  FastAetERC20__factory,
  AetERC20Collateral__factory,
  AetERC20__factory,
  AetERC721Collateral__factory,
  AetERC721URICollateral__factory,
  AetERC721URIStorage__factory,
  AetERC721__factory,
  AetERC4626Collateral__factory,
  AetERC4626OwnerCollateral__factory,
  AetERC4626__factory,
  AetFiatToken__factory,
  AetNative__factory,
  AetXERC20Lockbox__factory,
  AetXERC20__factory,
} from "@aetherium-nexus/core";

import { TokenType } from "./config.js";

export const aetERC20contracts = {
  [TokenType.fastCollateral]: "FastAetERC20Collateral",
  [TokenType.fastSynthetic]: "FastAetERC20",
  [TokenType.synthetic]: "AetERC20",
  [TokenType.syntheticRebase]: "AetERC4626",
  [TokenType.collateral]: "AetERC20Collateral",
  [TokenType.collateralFiat]: "AetFiatToken",
  [TokenType.XERC20]: "AetXERC20",
  [TokenType.XERC20Lockbox]: "AetXERC20Lockbox",
  [TokenType.collateralVault]: "AetERC4626OwnerCollateral",
  [TokenType.collateralVaultRebase]: "AetERC4626Collateral",
  [TokenType.native]: "AetNative",
  // uses same contract as native
  [TokenType.nativeScaled]: "AetNative",
};
export type AetERC20contracts = typeof aetERC20contracts;

export const aetERC20factories = {
  [TokenType.fastCollateral]: new FastAetERC20Collateral__factory(),
  [TokenType.fastSynthetic]: new FastAetERC20__factory(),
  [TokenType.synthetic]: new AetERC20__factory(),
  [TokenType.collateral]: new AetERC20Collateral__factory(),
  [TokenType.collateralVault]: new AetERC4626OwnerCollateral__factory(),
  [TokenType.collateralVaultRebase]: new AetERC4626Collateral__factory(),
  [TokenType.syntheticRebase]: new AetERC4626__factory(),
  [TokenType.collateralFiat]: new AetFiatToken__factory(),
  [TokenType.XERC20]: new AetXERC20__factory(),
  [TokenType.XERC20Lockbox]: new AetXERC20Lockbox__factory(),
  [TokenType.native]: new AetNative__factory(),
  [TokenType.nativeScaled]: new AetNative__factory(),
};
export type AetERC20Factories = typeof aetERC20factories;

export const aetERC721contracts = {
  [TokenType.collateralUri]: "AetERC721URICollateral",
  [TokenType.collateral]: "AetERC721Collateral",
  [TokenType.syntheticUri]: "AetERC721URIStorage",
  [TokenType.synthetic]: "AetERC721",
};

export type AetERC721contracts = typeof aetERC721contracts;

export const aetERC721factories = {
  [TokenType.collateralUri]: new AetERC721URICollateral__factory(),
  [TokenType.collateral]: new AetERC721Collateral__factory(),
  [TokenType.syntheticUri]: new AetERC721URIStorage__factory(),
  [TokenType.synthetic]: new AetERC721__factory(),
};
export type AetERC721Factories = typeof aetERC721factories;

export type TokenFactories = AetERC20Factories | AetERC721Factories;
