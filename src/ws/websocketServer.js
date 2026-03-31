const WebSocket = require('ws');

/**
 * Simple WebSocket server that broadcasts vehicle and alert updates
 * to connected dashboard clients.
 */
function createWebSocketServer(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

  const HEARTBEAT_INTERVAL = 30000; // 30 seconds – keeps connection alive

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, HEARTBEAT_INTERVAL);

    ws.on('message', (data) => {
      console.log('Received message from client:', data.toString());
    });

    ws.on('close', () => {
      clearInterval(heartbeat);
      console.log('WebSocket client disconnected');
    });

    ws.send(
      JSON.stringify({
        type: 'welcome',
        message: 'Connected to the server.',
      })
    );
  });

  function broadcast(payload) {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  return { wss, broadcast };
}

module.exports = {
  createWebSocketServer,
};
