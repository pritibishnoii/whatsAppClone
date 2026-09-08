import { WebSocketServer, WebSocket } from "ws";
import http from "node:http";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import express from "express";

const PORT = process.env.PORT ?? 8080;

const app = express();

const __fileName= fileURLToPath(import.meta.url);
const __dirname= path.dirname(__fileName)

// Public folder ki saari files (HTML, CSS, JS) automatic serve hongi
app.use(express.static(path.join(__dirname, "public")));

const httpServer=  http.createServer(app)
// const httpServer = new http.createServer((req, res) => {
//   console.log("Request URL:", req.url);

//   // let filePath = path.join(
//   //   __dirname,
//   //   "public",
//   //   req.url === "/" ? "index.html" : req.url
//   // );
//   const indexFile = fs.readFileSync(
//     path.join(__dirname, "public", "index.html"),
//     "utf-8"
//   );
//   res.setHeader("Content-Type", "text/html");
//   res.end(indexFile);
// });
const wsServer = new WebSocketServer({
  server: httpServer,
});

const users= new Map()
wsServer.on("connection", (socket) => {
  console.log("New connection");

  socket.on("message", (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());

      // ==========================
      // USER JOIN
      // ==========================

      if (data.type === "join") {
        const { userId, username } = data;

        users.set(userId, {
          username,
          socket,
        });

        console.log(`${username} joined`);

        // Send current users to newly joined user
        sendUsersList(socket);

        // Tell everyone about new online user
        broadcast({
          type: "presence",
          userId,
          username,
          status: "online",
        });

        return;
      }

      // ==========================
      // PRIVATE MESSAGE
      // ==========================

      if (data.type === "private-message") {
        const { senderId, receiverId, message, time } = data;

        const sender = users.get(senderId);
        const receiver = users.get(receiverId);

        if (!receiver) {
          console.log("Receiver is offline");

          socket.send(
            JSON.stringify({
              type: "message-error",
              message: "User is offline",
            })
          );

          return;
        }

        const messageData = {
          type: "private-message",
          senderId,
          senderName: sender?.username,
          receiverId,
          message,
          time,
        };

        // Send to receiver
        if (receiver.socket.readyState === WebSocket.OPEN) {
          receiver.socket.send(JSON.stringify(messageData));
        }

        // Send back to sender
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(messageData));
        }

        return;
      }

      // ==========================
      // TYPING
      // ==========================

      if (data.type === "typing") {
        const { senderId, receiverId, isTyping } = data;

        const receiver = users.get(receiverId);
        const sender = users.get(senderId);

        if (receiver && receiver.socket.readyState === WebSocket.OPEN) {
          receiver.socket.send(
            JSON.stringify({
              type: "typing",
              senderId,
              username: sender?.username,
              isTyping,
            })
          );
        }

        return;
      }
    } catch (error) {
      console.log("Invalid JSON:", error.message);
    }
  });

  // ==========================
  // DISCONNECT
  // ==========================

  socket.on("close", () => {
    for (const [userId, user] of users) {
      if (user.socket === socket) {
        users.delete(userId);

        console.log(`${user.username} went offline`);

        broadcast({
          type: "presence",
          userId,
          username,
          status: "offline",
        });

        break;
      }
    }
  });

  socket.on("error", (error) => {
    console.log("Socket error:", error.message);
  });
});

// ==========================
// SEND USERS LIST
// ==========================

function sendUsersList(socket) {
  const userList = [];

  for (const [userId, user] of users) {
    userList.push({
      userId,
      username: user.username,
      status: user.socket.readyState === WebSocket.OPEN ? "online" : "offline",
    });
  }

  socket.send(
    JSON.stringify({
      type: "users-list",
      users: userList,
    })
  );
}

// ==========================
// BROADCAST
// ==========================

function broadcast(data) {
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});