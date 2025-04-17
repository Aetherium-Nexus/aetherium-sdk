import {
  InterchainAccountIsm__factory,
  InterchainAccountRouter__factory,
} from "@aetherium-nexus/core";

import { proxiedFactories } from "../../router/types.js";

export const interchainAccountFactories = {
  interchainAccountRouter: new InterchainAccountRouter__factory(),
  interchainAccountIsm: new InterchainAccountIsm__factory(),
  ...proxiedFactories,
};

export type InterchainAccountFactories = typeof interchainAccountFactories;
