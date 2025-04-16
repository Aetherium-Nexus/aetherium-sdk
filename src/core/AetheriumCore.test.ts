import { MultiProvider } from "../providers/MultiProvider.js";

import { AetheriumCore } from "./AetheriumCore.js";

describe("AetheriumCore", () => {
  describe("fromEnvironment", () => {
    it("creates an object for testnet", async () => {
      const multiProvider = MultiProvider.createTestMultiProvider();
      AetheriumCore.fromAddressesMap({ test1: {} }, multiProvider);
    });
  });
});
