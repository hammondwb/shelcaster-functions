import { Stage, StageStrategy, SubscribeType, StreamType } from 'amazon-ivs-web-broadcast';

let websocket = null;
let stage = null;
let audioElement = null;
let audioContext = null;
let audioStream = null;

// UI Elements
const wsStatus = document.getElementById('ws-status');
const stageStatus = document.getElementById('stage-status');
const trackStatus = document.getElementById('track-status');
const audioPlayer = document.getElementById('audio-player');

// Initialize WebSocket connection to server
function initializeWebSocket() {
  websocket = new WebSocket('ws://localhost:3001');

  websocket.onopen = () => {
    console.log('WebSocket connected');
    wsStatus.textContent = 'Connected';
    wsStatus.className = 'connected';

    // Send ready message
    websocket.send(JSON.stringify({
      type: 'vp.ready',
      timestamp: new Date().toISOString()
    }));
  };

  websocket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      await handleMessage(message);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  websocket.onclose = () => {
    console.log('WebSocket disconnected');
    wsStatus.textContent = 'Disconnected';
    wsStatus.className = 'disconnected';

    // Reconnect after 5 seconds
    setTimeout(initializeWebSocket, 5000);
  };

  websocket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

async function handleMessage(message) {
  console.log('Received message:', message.type);

  switch (message.type) {
    case 'join_stage':
      await joinStage(message.stageToken, message.tracklistUrl);
      break;

    case 'leave_stage':
      await leaveStage();
      break;

    case 'play_track':
      await playTrack(message.trackUrl);
      break;

    case 'pause_track':
      pauseTrack();
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
}

async function joinStage(stageToken, tracklistUrl) {
  try {
    console.log('Joining stage...');

    // Create audio context for mixing
    audioContext = new AudioContext();

    // Create a silent audio stream (we'll add the track audio later)
    const oscillator = audioContext.createOscillator();
    oscillator.frequency.value = 0; // Silent
    const destination = audioContext.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.start();

    audioStream = destination.stream;

    // Create stage strategy
    const strategy = {
      stageStreamsToPublish: () => {
        return [
          {
            streamType: StreamType.AUDIO,
            device: audioStream,
          }
        ];
      },
      shouldPublishParticipant: () => true,
      shouldSubscribeToParticipant: () => SubscribeType.NONE, // Don't subscribe to others
    };

    // Create and join stage
    stage = new Stage(stageToken, strategy);

    stage.on('connectionStateChange', (state) => {
      console.log('Stage connection state:', state);
      stageStatus.textContent = state;
      stageStatus.className = state === 'connected' ? 'connected' : 'disconnected';

      sendStatus({
        connected: state === 'connected',
        state
      });
    });

    await stage.join();
    console.log('Joined stage successfully');

    // If tracklistUrl provided, start playing
    if (tracklistUrl) {
      await playTrack(tracklistUrl);
    }

  } catch (error) {
    console.error('Error joining stage:', error);
    sendStatus({
      connected: false,
      error: error.message
    });
  }
}

async function leaveStage() {
  if (stage) {
    await stage.leave();
    stage = null;
    stageStatus.textContent = 'Not Connected';
    stageStatus.className = 'disconnected';
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.src = '';
  }
}

async function playTrack(trackUrl) {
  try {
    console.log('Playing track:', trackUrl);

    // Set audio source
    audioPlayer.src = trackUrl;
    await audioPlayer.play();

    trackStatus.textContent = trackUrl.split('/').pop();

    // Connect audio to the stream
    if (audioContext && audioPlayer) {
      const source = audioContext.createMediaElementSource(audioPlayer);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination); // Also play locally for monitoring

      audioStream = destination.stream;

      // Update stage with new audio stream
      if (stage) {
        await stage.refreshStrategy();
      }
    }

    sendStatus({
      playing: true,
      track: trackUrl
    });

  } catch (error) {
    console.error('Error playing track:', error);
  }
}

function pauseTrack() {
  if (audioPlayer) {
    audioPlayer.pause();
    trackStatus.textContent = 'Paused';

    sendStatus({
      playing: false
    });
  }
}

function sendStatus(status) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({
      type: 'vp.status',
      ...status,
      timestamp: new Date().toISOString()
    }));
  }
}

// Initialize on load
initializeWebSocket();

