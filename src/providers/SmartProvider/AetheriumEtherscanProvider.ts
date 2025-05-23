import { providers } from "ethers";

import { objFilter, rootLogger, sleep } from "@aetherium-nexus/utils";

import { BlockExplorer } from "../../metadata/chainMetadataTypes.js";

import {
  IProviderMethods,
  ProviderMethod,
  excludeProviderMethods,
} from "./ProviderMethods.js";

// Used for crude rate-limiting of explorer queries without API keys
const hostToLastQueried: Record<string, number> = {};
const ETHERSCAN_THROTTLE_TIME = 6000; // 6.0 seconds

export class AetheriumEtherscanProvider
  extends providers.EtherscanProvider
  implements IProviderMethods
{
  protected readonly logger = rootLogger.child({ module: "EtherscanProvider" });
  // Seeing problems with these two methods even though etherscan api claims to support them
  public readonly supportedMethods = excludeProviderMethods([
    ProviderMethod.Call,
    ProviderMethod.EstimateGas,
    ProviderMethod.SendTransaction,
    ProviderMethod.MaxPriorityFeePerGas,
  ]);

  constructor(
    public readonly explorerConfig: BlockExplorer,
    network: providers.Networkish,
    public readonly options?: { debug?: boolean }
  ) {
    super(network, explorerConfig.apiKey);
    if (!explorerConfig.apiKey) {
      this.logger.warn(
        "AetheriumEtherscanProviders created without an API key will be severely rate limited. Consider using an API key for better reliability."
      );
    }
  }

  getBaseUrl(): string {
    if (!this.explorerConfig) return ""; // Constructor net yet finished
    const apiUrl = this.explorerConfig?.apiUrl;
    if (!apiUrl) throw new Error("Explorer config missing apiUrl");
    if (apiUrl.endsWith("/api")) return apiUrl.slice(0, -4);
    return apiUrl;
  }

  getUrl(module: string, params: Record<string, string>): string {
    const combinedParams = objFilter(params, (k, v): v is string => !!k && !!v);
    combinedParams["module"] = module;
    if (this.apiKey) combinedParams["apikey"] = this.apiKey;
    const parsedParams = new URLSearchParams(combinedParams);
    return `${this.getBaseUrl()}/api?${parsedParams.toString()}`;
  }

  getPostUrl(): string {
    return `${this.getBaseUrl()}/api`;
  }

  getHostname(): string {
    return new URL(this.getBaseUrl()).hostname;
  }

  getQueryWaitTime(): number {
    if (!this.isCommunityResource()) return 0;
    const hostname = this.getHostname();
    const lastExplorerQuery = hostToLastQueried[hostname] || 0;
    return ETHERSCAN_THROTTLE_TIME - (Date.now() - lastExplorerQuery);
  }

  async fetch(
    module: string,
    params: Record<string, any>,
    post?: boolean
  ): Promise<any> {
    if (!this.isCommunityResource()) return super.fetch(module, params, post);

    const hostname = this.getHostname();
    let waitTime = this.getQueryWaitTime();
    while (waitTime > 0) {
      if (this.options?.debug)
        this.logger.debug(
          `AetheriumEtherscanProvider waiting ${waitTime}ms to avoid rate limit`
        );
      await sleep(waitTime);
      waitTime = this.getQueryWaitTime();
    }

    hostToLastQueried[hostname] = Date.now();
    return super.fetch(module, params, post);
  }

  async perform(method: string, params: any, reqId?: number): Promise<any> {
    if (this.options?.debug)
      this.logger.debug(
        `AetheriumEtherscanProvider performing method ${method} for reqId ${reqId}`
      );
    if (!this.supportedMethods.includes(method as ProviderMethod))
      throw new Error(`Unsupported method ${method}`);

    if (method === ProviderMethod.GetLogs) {
      return this.performGetLogs(params);
    } else {
      return super.perform(method, params);
    }
  }

  // Overriding to allow more than one topic value
  async performGetLogs(params: { filter: providers.Filter }): Promise<any> {
    const args: Record<string, any> = { action: "getLogs" };
    if (params.filter.fromBlock)
      args.fromBlock = checkLogTag(params.filter.fromBlock);
    if (params.filter.toBlock)
      args.toBlock = checkLogTag(params.filter.toBlock);
    if (params.filter.address) args.address = params.filter.address;
    const topics = params.filter.topics;
    if (topics?.length) {
      if (topics.length > 2)
        throw new Error(`Unsupported topic count ${topics.length} (max 2)`);
      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        if (!topic || typeof topic !== "string" || topic.length !== 66)
          throw new Error(`Unsupported topic format: ${topic}`);
        args[`topic${i}`] = topic;
        if (i < topics.length - 1) args[`topic${i}_${i + 1}_opr`] = "and";
      }
    }

    return this.fetch("logs", args);
  }
}

// From ethers/providers/src.ts/providers/etherscan-provider.ts
function checkLogTag(blockTag: providers.BlockTag): number | "latest" {
  if (typeof blockTag === "number") return blockTag;
  if (blockTag === "pending") throw new Error("pending not supported");
  if (blockTag === "latest") return blockTag;
  return parseInt(blockTag.substring(2), 16);
}
