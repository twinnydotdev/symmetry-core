import { ConnectionManager } from '../src/connection-manager'
import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'

jest.mock('hyperswarm', () => {
  return jest.fn().mockImplementation(() => ({
    join: jest
      .fn()
      .mockReturnValue({ flushed: jest.fn().mockResolvedValue(undefined) }),
    on: jest.fn(),
    destroy: jest.fn().mockResolvedValue(undefined),
    flush: jest.fn(),
  }))
})

jest.mock('hypercore-crypto', () => ({
  discoveryKey: jest.fn().mockReturnValue(Buffer.from('test-discovery-key')),
}))

jest.mock('node:timers', () => ({
  setInterval: jest.fn().mockReturnValue(123),
  clearInterval: jest.fn(),
}))

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager
  let mockOnConnection: jest.Mock
  let mockOnDisconnection: jest.Mock
  let mockServerKey: Buffer

  beforeEach(() => {
    jest.clearAllMocks()

    mockOnConnection = jest.fn()
    mockOnDisconnection = jest.fn()
    mockServerKey = Buffer.from('test-server-key')

    connectionManager = new ConnectionManager({
      serverKey: mockServerKey,
      onConnection: mockOnConnection,
      onDisconnection: mockOnDisconnection,
      swarmOptions: undefined,
    })
  })

  test('connect should initialize Hyperswarm and join with discovery key', async () => {
    await connectionManager.connect()

    expect(Hyperswarm).toHaveBeenCalledWith(undefined)
    expect(crypto.discoveryKey).toHaveBeenCalledWith(mockServerKey)

    const mockSwarm = (Hyperswarm as unknown as jest.Mock).mock.results[0].value
    expect(mockSwarm.join).toHaveBeenCalledWith(
      Buffer.from('test-discovery-key'),
      {
        client: true,
        server: false,
      },
    )
    expect(mockSwarm.flush).toHaveBeenCalled()
    expect(mockSwarm.on).toHaveBeenCalledWith(
      'connection',
      expect.any(Function),
    )
    expect(mockSwarm.on).toHaveBeenCalledWith('error', expect.any(Function))
  })

  test('isConnected should return false when no peer is connected', () => {
    expect(connectionManager.isConnected).toBe(false)
  })

  test('currentPeer should return null when no peer is connected', () => {
    expect(connectionManager.currentPeer).toBeNull()
  })

  test('destroy should clean up resources', async () => {
    await connectionManager.connect()
    await connectionManager.destroy()

    const mockSwarm = (Hyperswarm as unknown as jest.Mock).mock.results[0].value
    expect(mockSwarm.destroy).toHaveBeenCalled()
  })
})
