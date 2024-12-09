import chalk from "chalk";
import crypto from "hypercore-crypto";
import Hyperswarm, { SwarmOptions } from "hyperswarm";

import { version as symmetryCoreVersion } from '../package.json'
import { Peer } from "./types";
import { logger } from "./logger";

interface ConnectionManagerConfig {
  serverKey: Buffer;
  onConnection: (peer: Peer) => void;
  onDisconnection?: () => void;
  swarmOptions: SwarmOptions | undefined;
}

export class ConnectionManager {
  private _config: ConnectionManagerConfig;
  private _currentPeer: Peer | null = null;
  private _heartbeatInterval: NodeJS.Timeout | null = null;
  private _isConnecting = false;
  private _serverSwarm: Hyperswarm | null = null;

  constructor(config: ConnectionManagerConfig) {
    this._config = config;
  }

  get isConnected(): boolean {
    return this._currentPeer !== null && this._currentPeer.writable;
  }

  get currentPeer(): Peer | null {
    return this._currentPeer;
  }

  async connect(): Promise<void> {
    try {
      if (this._serverSwarm) {
        await this._serverSwarm.destroy();
      }

      logger.info(`🔗 Connecting to server using symmetry-core version ${symmetryCoreVersion}`)

      this._serverSwarm = new Hyperswarm(this._config.swarmOptions);
      this._serverSwarm.join(crypto.discoveryKey(this._config.serverKey), {
        client: true,
        server: false,
      });
      this._serverSwarm.flush();

      this._serverSwarm.on("connection", this.handleConnection.bind(this));
      this._serverSwarm.on("error", this.handleSwarmError.bind(this));
    } catch (error) {
      this._isConnecting = false;
      const err = error as Error;
      logger.error(`Failed to create server connection: ${err.message}`);
      this.handleDisconnection();
    }
  }

  private handleConnection(peer: Peer): void {
    this._isConnecting = false;
    this._currentPeer = peer;

    logger.info(chalk.green("🔗 Connected to server."));

    peer.on("close", () => {
      if (!this._isConnecting) {
        this.handleDisconnection();
      }
    });

    peer.on("error", (err) => {
      logger.error(`Server connection error: ${err.message}`);
      if (!this._isConnecting) {
        this.handleDisconnection();
      }
    });

    this.startHeartbeat(peer);

    this._config.onConnection(peer);
  }

  private handleSwarmError(error: Error): void {
    logger.error(`Swarm error: ${error.message}`);
    this.handleDisconnection();
  }

  private handleDisconnection(): void {
    if (this._isConnecting) return;

    logger.warning("📡 Disconnected from server");

    this.cleanup();

    this._config.onDisconnection?.();
  }

  private startHeartbeat(peer: Peer): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
    }

    this._heartbeatInterval = setInterval(() => {
      if (peer.writable) {
        peer.write(JSON.stringify({ key: "heartbeat" }));
      } else {
        this.handleDisconnection();
      }
    }, 10000);
  }

  private cleanup(): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }

    if (this._currentPeer) {
      this._currentPeer.destroy();
      this._currentPeer = null;
    }
  }

  async destroy(): Promise<void> {
    this._isConnecting = false;
    this.cleanup();
    await this._serverSwarm?.destroy();
    this._serverSwarm = null;
  }
}
