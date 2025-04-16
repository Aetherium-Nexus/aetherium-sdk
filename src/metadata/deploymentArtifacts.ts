import { z } from "zod";

import { ZHash } from "./customZodTypes.js";

export const AetheriumDeploymentArtifactsSchema = z.object({
  mailbox: ZHash.describe("The address of the Mailbox contract."),
  merkleTreeHook: ZHash.describe(
    "The address of the Merkle Tree hook contract."
  ),
  interchainGasPaymaster: ZHash.describe(
    "The address of the Interchain Gas Paymaster (IGP) contract."
  ),
  validatorAnnounce: ZHash.describe(
    "The address of the Validator Announce contract."
  ),
  interchainSecurityModule: ZHash.optional().describe(
    "The address of the Interchain Security Module (ISM) contract."
  ),
});

export type AetheriumDeploymentArtifacts = z.infer<
  typeof AetheriumDeploymentArtifactsSchema
>;
