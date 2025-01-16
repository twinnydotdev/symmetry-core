/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatCompletionMessageParam } from "token.js";
import { serverMessageKeys } from "./constants";

export interface ProviderConfig {
  apiBasePath?: string;
  apiChatPath?: string;
  apiHealthPath?: string;
  apiHostname: string;
  apiKey?: string;
  apiModelsPath?: string;
  apiPort: number;
  apiProtocol: string;
  apiProvider: string;
  dataCollectionEnabled: boolean;
  maxConnections: number;
  modelName: string;
  name: string;
  dataPath: string;
  public: boolean;
  serverKey: string;
  systemMessage: string;
  userSecret: string;
}

export interface ProviderMessage<T = unknown> {
  key: string;
  data: T;
}

export interface InferenceRequest {
  key: string;
  messages: ChatCompletionMessageParam[];
}

export interface VersionMessage {
  minVersion: string
}

interface ReadableState {
  highWaterMark: number;
  buffer: any;
  length: number;
  pipes: any[];
  flowing: boolean | null;
  ended: boolean;
  endEmitted: boolean;
  reading: boolean;
  sync: boolean;
  needReadable: boolean;
  emittedReadable: boolean;
  readableListening: boolean;
  resumeScheduled: boolean;
  paused: boolean;
  emitClose: boolean;
  autoDestroy: boolean;
  destroyed: boolean;
  closed: boolean;
  closeEmitted: boolean;
  defaultEncoding: string;
  awaitDrainWriters: any;
  multiAwaitDrain: boolean;
  readingMore: boolean;
  decoder: null | any;
  encoding: null | string;
}

interface WritableState {
  highWaterMark: number;
  objectMode: boolean;
  finalCalled: boolean;
  needDrain: boolean;
  ending: boolean;
  ended: boolean;
  finished: boolean;
  destroyed: boolean;
  decodeStrings: boolean;
  defaultEncoding: string;
  length: number;
  writing: boolean;
  corked: number;
  sync: boolean;
  bufferProcessing: boolean;
  writecb: () => void;
  writelen: number;
  afterWriteTickInfo: null | any;
  bufferedRequest: null | any;
  lastBufferedRequest: null | any;
  pendingcb: number;
  prefinished: boolean;
  errorEmitted: boolean;
  emitClose: boolean;
  autoDestroy: boolean;
  bufferedRequestCount: number;
  corkedRequestsFree: any;
}

interface UDXStream {
  udx: UDX;
  socket: UDXSocket;
  id: number;
  remoteId: number;
  remoteHost: string;
  remoteFamily: number;
  remotePort: number;
  userData: any;
}

interface UDX {
  _handle: Buffer;
  _watchers: Set<any>;
  _buffer: Buffer;
}

interface UDXSocket {
  udx: UDX;
  _handle: Buffer;
  _inited: boolean;
  _host: string;
  _family: number;
  _ipv6Only: boolean;
  _port: number;
  _reqs: any[];
  _free: any[];
  _closing: null | any;
  _closed: boolean;
  streams: Set<any>;
  userData: any;
}

export interface Peer {
  publicKey: Buffer;
  remotePublicKey: Buffer;
  handshakeHash: Buffer;
  write: (value: string) => boolean;
  on: (event: string, listener: (...args: any[]) => void) => this;
  once: (event: string, listener: (...args: any[]) => void) => this;
  destroy: VoidFunction;
  writable: boolean;
  key: string;
  discovery_key: string;

  _duplexState: number;
  _readableState: ReadableState;
  _writableState: WritableState;

  noiseStream: Peer;
  isInitiator: boolean;
  rawStream: UDXStream;

  connected: boolean;
  keepAlive: number;
  timeout: number;
  userData: any;
  opened: Promise<void>;
  rawBytesWritten: number;
  rawBytesRead: number;
  relay: null | any;
  puncher: null | any;
  _rawStream: UDXStream;
  _handshake: null | any;
  _handshakePattern: null | any;
  _handshakeDone: null | any;
  _state: number;
  _len: number;
  _tmp: number;
  _message: null | any;
  _openedDone: () => void;
  _startDone: () => void;
  _drainDone: () => void;
  _outgoingPlain: null | any;
  _outgoingWrapped: null | any;
  _utp: null | any;
  _setup: boolean;
  _ended: number;
  _encrypt: {
    key: Buffer;
    state: Buffer;
    header: Buffer;
  };
  _decrypt: {
    key: Buffer;
    state: Buffer;
    final: boolean;
  };
  _timeoutTimer: null | NodeJS.Timeout;
  _keepAliveTimer: null | NodeJS.Timeout;
}

export interface Session {
  id: string;
  providerId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface PeerSessionRequest {
  modelName: string;
  preferredProviderId?: string;
}

export interface PeerWithSession extends Session {
  peer_key: string | null;
  discovery_key: string | null;
  model_name: string | null;
}

export interface PeerUpsert {
  key: string;
  discoveryKey: string;
  config: {
    modelName?: string;
    public?: boolean;
    serverKey?: string;
  };
}

export type ServerMessageKey = keyof typeof serverMessageKeys;

export interface StreamResponse {
  model: string
  created_at: string
  response: string
  content: string
  message: {
    content: string
  }
  done: boolean
  context: number[]
  total_duration: number
  load_duration: number
  prompt_eval_count: number
  prompt_eval_duration: number
  eval_count: number
  eval_duration: number
  type?: string
  choices: [
    {
      text: string
      delta: {
        content: string
      }
    }
  ]
}

export interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface OpenAIModelResponse {
  object: string;
  data: OpenAIModel[];
}

export interface TokenMetrics {
  length: number;
  processTime: number;
}

export interface StreamMetrics {
  averageTokenLength: number;
  processTimeMs: number;
  totalBytes: number;
  tokensPerSecond: number;
}

export interface StreamMetricsOptions {
  metricsInterval: number;
  maxTimeGap: number;
  windowSize: number;
}

export interface MetricsState {
  totalTokens: number;
  metricPoints: number;
  totalBytes: number;
  totalProcessTime: number;
  averageTokenLength: number;
  startTime: number;
  averageTokensPerSecond: number;
}
