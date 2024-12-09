import { PassThrough, Readable } from "node:stream";
import chalk from "chalk";
import Hyperswarm, { SwarmOptions } from "hyperswarm";
import crypto from "hypercore-crypto";
import fs from "node:fs";
import yaml from "js-yaml";
import cryptoLib from "crypto";
import { version as symmetryCoreVersion } from "../package.json";

import { ConfigManager } from "./config";
import {
  createMessage,
  getChatDataFromProvider,
  safeParseJson,
  safeParseStreamResponse,
} from "./utils";
import { logger } from "./logger";
import {
  Peer,
  ProviderMessage,
  InferenceRequest,
  Message,
  StreamMetrics,
  VersionMessage,
} from "./types";
import { PROVIDER_HELLO_TIMEOUT, serverMessageKeys } from "./constants";
import { ReadableStream } from "stream/web";
import { pipeline } from "node:stream/promises";
import { StreamMetricsCollector } from "./metrics";
import { ConnectionManager } from "./connection-manager";

export class SymmetryClient {
  private _challenge: Buffer | null = null;
  private _config: ConfigManager;
  private _connectionManager: ConnectionManager | null = null;
  private _conversationIndex = 0;
  private _discoveryKey: Buffer | null = null;
  private _isPublic = false;
  private _providerConnections: number = 0;
  private _providerSwarm: Hyperswarm | null = null;
  private _serverPeer: Peer | null = null;
  private _serverSwarm: Hyperswarm | null = null;

  constructor(configPath: string) {
    logger.info(`🔗 Initializing client using config file: ${configPath}`);
    this._config = new ConfigManager(configPath);
    this._isPublic = this._config.get("public");
  }

  async init(): Promise<void> {
    const userSecret = await this.getOrCreateUserSecret();
    const keyPair = crypto.keyPair(
      cryptoLib.createHash("sha256").update(userSecret).digest()
    );
    this._providerSwarm = new Hyperswarm({
      maxConnections: this._config.get("maxConnections"),
    });
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

    logger.info(`📁 Symmetry client initialized.`);
    logger.info(`🔑 Discovery key: ${this._discoveryKey.toString("hex")}`);

    if (this._isPublic) {
      logger.info(
        chalk.white(`🔑 Server key: ${this._config.get("serverKey")}`)
      );
      logger.info(chalk.white("🔗 Joining server, please wait."));
      this.joinServer({
        keyPair,
        maxConnections: this._config.get("maxConnections"),
      });
    }

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
      const testMessages: Message[] = [
        { role: "user", content: "Hello, this is a test message." },
      ];
      const req = this.buildChatStreamRequest(testMessages);

      if (!req) {
        logger.error(chalk.red("❌ Failed to build test request"));
        throw new Error("Failed to build test request");
      }

      const { requestOptions, requestBody } = req;
      const { protocol, hostname, port, path, method, headers } =
        requestOptions;
      const url = `${protocol}://${hostname}:${port}${path}`;

      logger.info(chalk.white(`🚀 Sending test request to ${url}`));

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          logger.error(
            chalk.red(
              `❌ Server responded with status code: ${response.status}`
            )
          );
          this.destroySwarms();
          throw new Error(
            `Server responded with status code: ${response.status}`
          );
        }

        if (!response.body) {
          logger.error(
            chalk.red("❌ Failed to get a ReadableStream from the response")
          );
          this.destroySwarms();
          throw new Error("Failed to get a ReadableStream from the response");
        }

        logger.info(chalk.white(`📡 Got response, checking stream...`));

        const reader = response.body.getReader();
        const { done } = await reader.read();
        if (done) {
          logger.error(chalk.red("❌ Stream ended without data"));
          this.destroySwarms();
          throw new Error("Stream ended without data");
        }

        logger.info(chalk.green(`✅ Test inference call successful!`));
      } catch (error) {
        this.destroySwarms();
        logger.error(
          chalk.red(`❌ Error during test inference call: ${error}`)
        );
        throw error;
      }
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

    this._challenge = crypto.randomBytes(32);

    peer.write(
      createMessage(serverMessageKeys.challenge, {
        challenge: this._challenge,
      })
    );

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
          case serverMessageKeys.challenge:
            this.handleServerVerification(
              data.data as { message: string; signature: { data: string } }
            );
            break;
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

  handleServerVerification(data: {
    message: string;
    signature: { data: string };
  }) {
    if (!this._challenge) {
      console.log("No challenge set. Cannot verify.");
      return;
    }

    const serverKeyHex = this._config.get("serverKey");
    try {
      const publicKey = this.getServerPublicKey(serverKeyHex);
      const signatureBuffer = Buffer.from(data.signature.data, "base64");

      const verified = crypto.verify(
        this._challenge,
        signatureBuffer,
        publicKey
      );

      if (verified) {
        logger.info(chalk.greenBright(`✅ Verification successful.`));
      } else {
        logger.error(`❌ Verification failed!`);
      }
    } catch (error) {
      console.error("Error during verification:", error);
    }
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

  private getMessagesWithSystem(messages: Message[]): Message[] {
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

  private async handleInferenceRequest(
    data: ProviderMessage<InferenceRequest>,
    peer: Peer
  ): Promise<void> {
    const streamMetricsCollector = new StreamMetricsCollector({
      metricsInterval: 10,
      maxTimeGap: 5000,
      windowSize: 100,
    });

    this._serverPeer?.write(createMessage(serverMessageKeys.inference));

    const messages = this.getMessagesWithSystem(data?.data.messages);
    const req = this.buildChatStreamRequest(messages);

    if (!req) return;

    const { requestOptions, requestBody } = req;
    const { protocol, hostname, port, path, method, headers } = requestOptions;
    const url = `${protocol}://${hostname}:${port}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(
          `Server responded with status code: ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error("Failed to get a ReadableStream from the response");
      }

      const responseStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>
      );
      const peerStream = new PassThrough();
      responseStream.pipe(peerStream);
      let completion = "";
      const metrics: StreamMetrics[] = [];

      const provider = this._config.get("apiProvider");

      const peerPipeline = pipeline(peerStream, async function (source) {
        for await (const chunk of source) {
          if (peer.writable) {
            const tokenContent = getChatDataFromProvider(
              provider,
              safeParseStreamResponse(chunk.toString())
            );

            completion += tokenContent;

            const metric = await streamMetricsCollector.processToken(
              tokenContent || ""
            );
            if (metric) metrics.push(metric);

            const write = peer.write(chunk);
            if (!write) {
              await new Promise((resolve) => peer.once("drain", resolve));
            }
          } else {
            break;
          }
        }
      });

      await Promise.resolve(peerPipeline);

      this.sendRequestMetrics(streamMetricsCollector, peer);

      if (
        this._config.get("dataCollectionEnabled") &&
        data.data.key === serverMessageKeys.inference
      ) {
        this.saveCompletion(completion, peer, data.data.messages);
      }
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
    } finally {
      peer.write(
        createMessage(serverMessageKeys.inferenceEnded, data?.data.key)
      );
    }
  }

  private sendRequestMetrics(metrics: StreamMetricsCollector, peer: Peer) {
    this._serverPeer?.write(
      createMessage(serverMessageKeys.sendMetrics, {
        state: metrics.getMetricsState(),
        peerId: peer.publicKey.toString("hex"),
        timestamp: Date.now(),
      })
    );
  }

  private async saveCompletion(
    completion: string,
    peer: Peer,
    messages: Message[]
  ) {
    fs.writeFile(
      `${this._config.get("dataPath")}/${peer.publicKey.toString("hex")}-${
        this._conversationIndex
      }.json`,
      JSON.stringify([
        ...messages,
        {
          role: "assistant",
          content: completion,
        },
      ]),
      () => {
        logger.info(`📝 Completion saved to file`);
      }
    );
  }

  private buildChatStreamRequest(messages: Message[]) {
    const requestOptions = {
      hostname: this._config.get("apiHostname"),
      port: Number(this._config.get("apiPort")),
      path: this._config.get("apiChatPath"),
      protocol: this._config.get("apiProtocol"),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this._config.get("apiKey")}`,
      },
    };

    const requestBody = {
      model: this._config.get("modelName"),
      messages: messages || undefined,
      stream: true,
    };

    return { requestOptions, requestBody };
  }
}

export default SymmetryClient;
