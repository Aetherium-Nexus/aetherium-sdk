import { InterchainQueryRouter__factory } from "@aetherium-nexus/core";

import { proxiedFactories } from "../../router/types.js";

export const interchainQueryFactories = {
  interchainQueryRouter: new InterchainQueryRouter__factory(),
  ...proxiedFactories,
};

export type InterchainQueryFactories = typeof interchainQueryFactories;
