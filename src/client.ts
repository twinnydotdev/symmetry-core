import chalk from "chalk";
import Hyperswarm, { SwarmOptions } from "hyperswarm";
import crypto from "hypercore-crypto";
import fs from "node:fs";
import yaml from "js-yaml";
import cryptoLib from "crypto";
import { version as symmetryCoreVersion } from "../package.json";
import { ChatCompletionMessageParam, TokenJS as FluencyJs } from "fluency.js";

import { ConfigManager } from "./config";
import { createMessage, safeParseJson } from "./utils";
import { logger } from "./logger";
import {
  Peer,
  ProviderMessage,
  InferenceRequest,
  VersionMessage,
} from "./types";
import {
  apiProviders,
  PROVIDER_HELLO_TIMEOUT,
  serverMessageKeys,
} from "./constants";
import { ConnectionManager } from "./connection-manager";
import { CompletionStreaming, LLMProvider } from "fluency.js/dist/chat";

export class SymmetryClient {
  private _config: ConfigManager;
  private _connectionManager: ConnectionManager | null = null;
  private _conversationIndex = 0;
  private _discoveryKey: Buffer | null = null;
  private _providerConnections: number = 0;
  private _providerSwarm: Hyperswarm | null = null;
  private _serverPeer: Peer | null = null;
  private _serverSwarm: Hyperswarm | null = null;
  private _fluencyJs: FluencyJs | undefined;

  constructor(configPath: string) {
    logger.info(`🔗 Initializing client using config file: ${configPath}`);
    this._config = new ConfigManager(configPath);
  }

  async init(): Promise<void> {
    const userSecret = await this.getOrCreateUserSecret();
    const keyPair = crypto.keyPair(
      cryptoLib.createHash("sha256").update(userSecret).digest()
    );

    logger.info(`📁 Symmetry client initialized.`);

    logger.info(
      chalk.white(`🔑 Server key: ${this._config.get("serverKey")}`)
    );
    logger.info(chalk.white("🔗 Joining server, please wait."));
    
    this._providerSwarm = new Hyperswarm();
    this._discoveryKey = crypto.discoveryKey(keyPair.publicKey);
    const discovery = this._providerSwarm.join(this._discoveryKey, {
      server: true,
      client: true,
    });
    await discovery.flushed();

    this._providerSwarm.on("error", (err: Error) => {
      logger.error(chalk.red("🚨 Swarm Error:"), err);
    });

    this._providerSwarm.on("connection", (peer: Peer) => {
      logger.info(`⚡️ New connection from peer: ${peer.rawStream.remoteHost}`);
      this.listeners(peer);
    });

    this.joinServer({ keyPair });

    process.on("SIGINT", async () => {
      await this._providerSwarm?.destroy();
      process.exit(0);
    });

    process.on("uncaughtException", (err) => {
      if (err.message === "connection reset by peer") {
        this._providerConnections = Math.max(0, this._providerConnections - 1);
      }
    });
  }

  async getOrCreateUserSecret() {
    const userSecret = this._config.get("userSecret");

    if (userSecret) return userSecret;

    const newSecret = crypto.randomBytes(32).toString("hex");

    logger.info(
      chalk.white(`🔒 Secret not created, writing new secret to config file...`)
    );

    await fs.promises.writeFile(
      this._config.getConfigPath(),
      yaml.dump({
        ...this._config.getAll(),
        userSecret: newSecret,
      }),
      "utf8"
    );

    return newSecret;
  }

  private async testProviderCall(): Promise<void> {
    const testCall = async () => {
      logger.info(chalk.white(`👋 Saying hello to your provider...`));

      const url = this.getProviderBaseUrl();

      this._fluencyJs = new FluencyJs({
        baseURL: url,
        apiKey: this._config.get("apiKey"),
      });

      logger.info(chalk.white(`🚀 Sending test request to ${url}`));

      try {
        await this._fluencyJs?.chat.completions.create({
          model: this._config.get("modelName"),
          messages: [
            { role: "user", content: "Hello, this is a test message." },
          ],
          stream: true,
          provider: "openai-compatible",
        });
      } catch (error) {
        let errorMessage = "Health check failed";
        if (error instanceof Error) errorMessage = error.message;
        logger.error(`🚨 Health check error: ${errorMessage}`);
        this.destroySwarms();
        throw new Error(errorMessage);
      }

      logger.info(chalk.green(`✅ Test inference call successful!`));
    };

    setTimeout(() => testCall(), PROVIDER_HELLO_TIMEOUT);
  }

  async joinServer(opts?: SwarmOptions): Promise<void> {
    const serverKey = Buffer.from(this._config.get("serverKey"));

    this._connectionManager = new ConnectionManager({
      onConnection: this.handleConnection,
      serverKey,
      swarmOptions: opts,
      onDisconnection: () => (this._serverPeer = null),
    });

    await this._connectionManager.connect();
  }

  handleConnection = (peer: Peer) => {
    this._serverPeer = peer;

    peer.write(
      createMessage(serverMessageKeys.join, {
        ...this._config.getAll(),
        symmetryCoreVersion,
        discoveryKey: this._discoveryKey?.toString("hex"),
        apiKey: "",
      })
    );

    this.testProviderCall();

    peer.on("data", async (buffer: Buffer) => {
      if (!buffer) return;

      const data = safeParseJson<
        ProviderMessage<
          { message: string; signature: { data: string } } | VersionMessage
        >
      >(buffer.toString());

      if (data && data.key) {
        switch (data.key) {
          case serverMessageKeys.versionMismatch: {
            const message = data.data as VersionMessage;
            logger.info(
              `
                ❌ Version mismatch minimum required symmetry client is v${message.minVersion}; Destroying connection, please update.
              `.trim()
            );
            this._connectionManager?.destroy();
            break;
          }
          case serverMessageKeys.inference:
            logger.info(
              chalk.white(`🔗 Received inference request from server.`)
            );
            this.handleInferenceRequest(
              data as unknown as ProviderMessage<InferenceRequest>,
              peer
            );
            break;
          case serverMessageKeys.healthCheck:
            this.handleHealthCheckRequest(peer);
            break;
          case serverMessageKeys.healthCheckAck:
            this.handleHealthCheckAck();
            break;
        }
      }
    });
  };

  async destroySwarms() {
    await this._providerSwarm?.destroy();
    await this._serverSwarm?.destroy();
  }

  getServerPublicKey(serverKeyHex: string): Buffer {
    const publicKey = Buffer.from(serverKeyHex, "hex");
    if (publicKey.length !== 32) {
      throw new Error(
        `Expected a 32-byte public key, but got ${publicKey.length} bytes`
      );
    }
    return publicKey;
  }

  private listeners(peer: Peer): void {
    peer.on("data", async (buffer: Buffer) => {
      if (!buffer) return;
      const data = safeParseJson<ProviderMessage<InferenceRequest>>(
        buffer.toString()
      );
      if (data && data.key) {
        switch (data.key) {
          case serverMessageKeys.newConversation:
            this._conversationIndex = this._conversationIndex + 1;
            break;
          case serverMessageKeys.inference:
            logger.info(
              `📦 Inference message received from ${peer.rawStream.remoteHost}`
            );
            await this.handleInferenceRequest(data, peer);
            break;
        }
      }
    });
  }

  private getMessagesWithSystem(
    messages: ChatCompletionMessageParam[]
  ): ChatCompletionMessageParam[] {
    const systemMessage = this._config.get("systemMessage");

    const hasSystem = messages.some((m) => m.role === "system");

    if (systemMessage && !hasSystem) {
      return [
        {
          role: "system",
          content: systemMessage,
        },
        ...messages,
      ];
    }

    return messages;
  }
  private async handleHealthCheckAck(): Promise<void> {
    logger.info(
      `🤖 Health check ack received from server.`
    );
  }

  private async handleHealthCheckRequest(peer: Peer): Promise<void> {
    logger.info("🤖 Health check request received.");

    this._fluencyJs = new FluencyJs({
      baseURL: this.getProviderBaseUrl(),
      apiKey: this._config.get("apiKey"),
    });

    const body: CompletionStreaming<LLMProvider> = {
      model: this._config.get("modelName"),
      messages: [
        {
          role: "user",
          content: `Hello, reply with one word only if you are alive. e.g "alive".`,
        },
      ],
      stream: true,
      provider: "openai-compatible",
    };

    try {
      await this._fluencyJs?.chat.completions.create(body);
      peer.write(createMessage(serverMessageKeys.healthCheck));
    } catch (error) {
      let errorMessage = "Health check failed";
      if (error instanceof Error) errorMessage = error.message;
      logger.error(`🚨 Health check error: ${errorMessage}`);
    }
  }

  public getIsOpenAICompatible = (provider: string) => {
    const providers = Object.values(apiProviders) as string[];
    return providers.includes(provider);
  };

  public getProviderBaseUrl = () => {
    return `${this._config.get("apiProtocol")}://${this._config.get(
      "apiHostname"
    )}${
      this._config.get("apiPort") ? `:${this._config.get("apiPort")}` : ""
    }${
      this._config.get("apiBasePath") ? this._config.get("apiBasePath") : ""
    }`;
  };

  private async handleInferenceRequest(
    data: ProviderMessage<InferenceRequest>,
    peer: Peer
  ): Promise<void> {
    this._serverPeer?.write(createMessage(serverMessageKeys.inference));

    const messages = this.getMessagesWithSystem(data?.data.messages);

    this._fluencyJs = new FluencyJs({
      baseURL: this.getProviderBaseUrl(),
      apiKey: this._config.get("apiKey"),
    });

    try {
      const result = await this._fluencyJs.chat.completions.create({
        model: this._config.get("modelName"),
        messages: messages || undefined,
        stream: true,
        provider: "openai-compatible"
      });
      
      for await (const part of result) {
        peer.write(JSON.stringify(part));
      }

      peer.write(
        createMessage(serverMessageKeys.inferenceEnded, data?.data.key)
      );

      await new Promise((resolve) => peer.once("drain", resolve));
  
    } catch (error) {
      let errorMessage = "An error occurred during inference";
      if (error instanceof Error) errorMessage = error.message;
      logger.error(`🚨 ${errorMessage}`);

      this._serverPeer?.write(
        createMessage(serverMessageKeys.inferenceError, {
          requestId: data.data.key,
          error: errorMessage,
        })
      );
    } 
  }
}

export default SymmetryClient;
