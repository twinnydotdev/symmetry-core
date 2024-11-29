# Symmetry Core

Use this repository to become an inference provider on the Symmetry network programmatically.

Symmetry is a decentralized peer-to-peer network tool that allows users to share computational resources for AI inference. It enables users to connect directly and securely with each other, offering or seeking computational power for various AI tasks.

## Installation

```bash
npm install symmetry-core
```

## Usage

To create a new Symmetry provider:

```javascript
import { SymmetryProvider } from 'symmetry-core';

const config = {
  // ... your configuration object
};

const provider = new SymmetryProvider(config);
provider.init();
```

## Configuration

Here's an example configuration object for creating a SymmetryProvider:

```javascript
const config = {
  apiHostname: "localhost",
  apiKey: "",
  apiPath: "/v1/chat/completions",
  apiPort: 11434,
  apiProtocol: "http",
  apiProvider: "ollama",
  dataCollectionEnabled: false,
  maxConnections: 10,
  modelName: "llama3.1:latest",
  name: "twinnydotdev",
  path: "/home/twinnydotdev/.config/symmetry/data",
  public: true,
  serverKey: "4b4a9cc325d134dee6679e9407420023531fd7e96c563f6c5d00fd5549b77435",
  systemMessage: "I'm a system message",
  userSecret: "mystrongpassword"
};

const provider = new SymmetryProvider(config);
```

### Configuration Fields

- `apiHostname`: The hostname of the API server.
- `apiKey`: The API key for authentication (if required).
- `apiChatPath`: The endpoint path for chat completions.
- `apiPort`: The port number on which the API server is listening.
- `apiProtocol`: The protocol used to communicate with the API server.
- `apiProvider`: The name of the API provider.
- `dataCollectionEnabled`: Whether to enable data collection.
- `maxConnections`: The maximum number of connections.
- `modelName`: The name and version of the AI model to use.
- `name`: Your chosen name as a provider on the Symmetry network.
- `dataPath`: The local path where Symmetry will store its configuration and data files.
- `public`: Whether this provider is publicly accessible on the Symmetry network.
- `serverKey`: The unique key for connecting to the Symmetry server.
- `userSecret`: The secret key for user uniqueness and points tracking.
- `systemMessage`: An optional system message for each conversation.

Adjust these settings according to your preferences and setup.

## Contributing

Contributions are welcome! Please submit your pull requests to the [GitHub repository](https://github.com/twinnydotdev/symmetry-core/pulls).

## License

This project is licensed under the [MIT License](https://github.com/twinnydotdev/symmetry-core/blob/master/LICENCE).

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/twinnydotdev/symmetry-core/issues) on GitHub.

## Acknowledgments

We thank [Hyperswarm](https://github.com/holepunchto/hyperswarm) for providing the underlying peer-to-peer networking capabilities.
