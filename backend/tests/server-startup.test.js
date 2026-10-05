const mockServer = { on: jest.fn() };
const mockListen = jest.fn((port, callback) => {
  setImmediate(() => callback());
  return mockServer;
});

jest.mock('../src/config/database', () => ({
  connectDB: jest.fn().mockRejectedValue(new Error('DB unavailable')),
}));

jest.mock('../src/config/redis', () => ({
  connectRedis: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
  getRedis: jest.fn(),
}));

jest.mock('../src/config/rabbitmq', () => ({
  connectRabbitMQ: jest.fn().mockRejectedValue(new Error('RabbitMQ unavailable')),
  getChannel: jest.fn(),
}));

jest.mock('../src/workers/outboxRelay', () => ({
  startOutboxRelay: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/workers/orderConsumer', () => ({
  startOrderConsumer: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/workers/reservationExpiryWorker', () => ({
  startReservationExpiryWorker: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/app', () => ({
  listen: mockListen,
}));

describe('server startup', () => {
  beforeEach(() => {
    jest.resetModules();
    mockListen.mockClear();
    mockServer.on.mockClear();
  });

  it('keeps the API alive when external services are unavailable', async () => {
    const { start } = require('../src/server');

    await expect(start()).resolves.toBe(mockServer);
    expect(mockListen).toHaveBeenCalledTimes(1);
  });
});
