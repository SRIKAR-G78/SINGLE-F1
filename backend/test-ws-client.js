const WebSocket = require('ws');

const url = process.argv[2] || 'ws://localhost:8080';
console.log('Connecting to', url);
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('Client: connected');
});

ws.on('message', (msg) => {
  console.log('Client: message:', msg.toString());
});

ws.on('error', (err) => {
  console.error('Client: error:', err && err.message ? err.message : err);
});

ws.on('close', (code, reason) => {
  console.log('Client: closed', code, reason && reason.toString());
});
