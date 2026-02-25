const WebSocket = require('ws');

/**
 * Simple WebSocket server that broadcasts vehicle and alert updates
 * to connected dashboard clients.
 */
function createWebSocketServer(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('message', (data) => {
      console.log('Received message from client:', data.toString());
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.send(
      JSON.stringify({
        type: 'welcome',
        message: 'Connected to Hollywood microtransit WebSocket server',
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
