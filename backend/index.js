const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });

console.log(`Backend WebSocket server started on port ${PORT}`);

wss.on('connection', (frontendWs) => {
    console.log('Frontend client connected.');
    let derivWs = null;

    frontendWs.on('message', (message) => {
        const data = JSON.parse(message);

        // The first message from the frontend should contain the authorization token.
        if (data.authorize && !derivWs) {
            const token = data.authorize;
            const appId = process.env.VITE_DERIV_APP_ID || '1089';
            
            console.log('Received auth token. Connecting to Deriv API...');
            
            derivWs = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);

            // When the connection to Deriv is open, authorize it.
            derivWs.onopen = () => {
                console.log('Connected to Deriv API.');
                derivWs.send(JSON.stringify({ authorize: token }));
            };

            // Forward messages from Deriv to the frontend.
            derivWs.onmessage = (event) => {
                frontendWs.send(event.data);
            };

            // Handle the Deriv connection closing.
            derivWs.onclose = () => {
                console.log('Disconnected from Deriv API.');
                if (frontendWs.readyState === WebSocket.OPEN) {
                    frontendWs.close();
                }
            };

            // Handle errors from the Deriv connection.
            derivWs.onerror = (error) => {
                console.error('Deriv API WebSocket error:', error.message);
                if (frontendWs.readyState === WebSocket.OPEN) {
                    frontendWs.send(JSON.stringify({ error: { message: 'Failed to connect to Deriv API.' } }));
                }
            };

            // Forward subsequent messages from the frontend to Deriv.
            frontendWs.on('message', (msg) => {
                if (derivWs && derivWs.readyState === WebSocket.OPEN) {
                    const msgData = JSON.parse(msg);
                    // Avoid re-authorizing
                    if (!msgData.authorize) {
                        derivWs.send(msg);
                    }
                }
            });

        } else if (derivWs && derivWs.readyState === WebSocket.OPEN) {
            // If the Deriv connection is already open, just forward the message.
            derivWs.send(message);
        } else {
            // This handles cases where messages are sent before authorization.
            console.warn('Received message before connection was established or authorized.');
            frontendWs.send(JSON.stringify({ error: { message: 'Backend not ready. Please send authorization first.' }}));
        }
    });

    // Handle the frontend connection closing.
    frontendWs.on('close', () => {
        console.log('Frontend client disconnected.');
        if (derivWs && derivWs.readyState === WebSocket.OPEN) {
            derivWs.close();
        }
    });

    // Handle errors from the frontend connection.
    frontendWs.on('error', (error) => {
        console.error('Frontend WebSocket error:', error.message);
        if (derivWs) {
            derivWs.close();
        }
    });
});
