# Aetherium SDK

Aetherium SDK that helps developers to create and manage interchain applications

For more details on Aetherium concepts, [see the documentation](https://docs.aetherium-nexus.com)

## Install

```bash
# Install with NPM
npm install @aetherium-nexus/sdk

# Or with Yarn
yarn add @aetherium-nexus/sdk
```

Note, this package uses [ESM Modules](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c#pure-esm-package)

## Contents

The SDK includes various classes for building, deploying, and testing multi-chain applications. Different abstractions serve different use cases. A few common utilities include:

- `MultiProvider` / `MultiProtocolProvider`: A utility for managing chain metadata, and RPC providers.
- `AetheriumApp` / `MultiProtocolApp`: A base to extend for a multi-chain app.
- `AetheriumCore` / `MultiProtocolCore`: A class for common interactions with Aetherium core deployments.
- `AetheriumDeployer`: The base class for executing multi-chain contract deployments.
- `Token` & `WarpCore`: Utilities for interacting with Warp Route deployments.

## License

Apache 2.0
