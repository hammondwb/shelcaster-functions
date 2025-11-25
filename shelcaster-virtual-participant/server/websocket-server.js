import { WebSocketServer as WSServer } from 'ws';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export class WebSocketServer {
  constructor(port = 3001) {
    this.wss = new WSServer({
      port,
      perMessageDeflate: false
    });

    this.clients = new Map();
    this.browserClient = null;

    // Initialize DynamoDB client
    const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
    this.ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
    this.vpTableName = process.env.VP_TABLE_NAME || 'shelcaster-virtual-participants';

    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      console.log(`Client connected: ${clientId}`);

      const client = {
        id: clientId,
        ws,
        isReady: false
      };

      this.clients.set(clientId, client);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(client, message);
        } catch (error) {
          console.error('Error handling message:', error);
          this.sendError(ws, error.message);
        }
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
    });

    console.log('WebSocket server setup complete');
  }

  async handleMessage(client, message) {
    console.log(`Received message from ${client.id}:`, message.type);

    switch (message.type) {
      case 'vp.ready':
        this.handleVpReady(client);
        break;

      case 'vp.join_stage':
        await this.handleJoinStage(client, message);
        break;

      case 'vp.leave_stage':
        await this.handleLeaveStage(client, message);
        break;

      case 'vp.play_track':
        await this.handlePlayTrack(client, message);
        break;

      case 'vp.pause_track':
        await this.handlePauseTrack(client, message);
        break;

      case 'vp.status':
        this.handleStatus(client, message);
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  handleVpReady(client) {
    client.isReady = true;
    this.browserClient = client;
    console.log('Virtual participant is ready');

    this.send(client.ws, {
      type: 'vp.ready_ack',
      timestamp: new Date().toISOString()
    });
  }

  async handleJoinStage(client, message) {
    const { stageToken, showId, tracklistUrl } = message;

    if (!stageToken) {
      this.sendError(client.ws, 'Missing stageToken');
      return;
    }

    // Forward to browser client
    if (this.browserClient) {
      this.send(this.browserClient.ws, {
        type: 'join_stage',
        stageToken,
        showId,
        tracklistUrl
      });
    }
  }

  async handleLeaveStage(client, message) {
    if (this.browserClient) {
      this.send(this.browserClient.ws, {
        type: 'leave_stage'
      });
    }
  }

  async handlePlayTrack(client, message) {
    const { trackUrl } = message;

    if (this.browserClient) {
      this.send(this.browserClient.ws, {
        type: 'play_track',
        trackUrl
      });
    }
  }

  async handlePauseTrack(client, message) {
    if (this.browserClient) {
      this.send(this.browserClient.ws, {
        type: 'pause_track'
      });
    }
  }

  handleStatus(client, message) {
    // Broadcast status to all connected clients
    this.broadcastToClients({
      type: 'vp.status_update',
      ...message
    });
  }

  send(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(ws, error) {
    this.send(ws, {
      type: 'error',
      error: error.toString()
    });
  }

  broadcastToClients(message) {
    this.clients.forEach((client) => {
      this.send(client.ws, message);
    });
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

