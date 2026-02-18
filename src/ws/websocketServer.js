const WebSocket = require('ws');

/**
 * Simple WebSocket server that will broadcast vehicle and alert updates
 * to connected dashboard clients.
 *
 * Architecture path:
 *   Custom REST API (Express) -> WebSocket Server (this file) -> Render -> OpenLayers UI
 */
function createWebSocketServer(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('message', (data) => {
      // For now, just log. Later we can support simple client pings or filters.
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

  /**
   * Broadcast helper – other services (e.g., RideCircuit poller)
   * will use this to push real-time vehicle and alert updates.
   */
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

