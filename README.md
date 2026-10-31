# Unknown Arcade — Multiplayer

A real-time browser multiplayer arena game. All players play simultaneously in one shared arena.

## Rules
- Minimum 2 players; maximum 8.
- Host creates a room and shares the 4-character room code.
- Players join before the host starts.
- 60-second match; cyan signals add 10 points.
- Red hazards subtract 20 points.
- Highest score when time expires wins.
- Pulse clears nearby hazards and collects nearby cyan signals.

## Run locally
1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.

## Deploy on Render
- Push this project folder to a GitHub repository.
- In Render choose **New → Web Service** and connect that repository.
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Deploy and open the generated `onrender.com` URL.

Use a Web Service, not a Static Site: this game needs its Node.js + Socket.IO server for multiplayer. Render free services may sleep after inactivity, so the first connection after a quiet period can take time to wake.
