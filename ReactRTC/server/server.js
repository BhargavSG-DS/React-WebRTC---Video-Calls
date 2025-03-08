// require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan"); // Import morgan for logging

const app = express();

app.use(cors());
app.use(morgan("combined")); // Use morgan for logging

const server = require("http").createServer(app);

const io = require("socket.io")(server, {
	cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] },
});

const PORT = process.env.PORT || 3000;

io.on("connection", (socket) => {
	console.log("New user connected");

	socket.on("join-room", (roomId, userId) => {
		console.log(`User ${userId} joined room ${roomId}`);
		socket.join(roomId);

		socket.to(roomId).emit("user-connected", userId);

		socket.on("disconnect", () => {
			console.log(`User ${userId} disconnected from room ${roomId}`);
			socket.to(roomId).emit("user-disconnected", userId);
		});
	});

	socket.on("message", (message) => {
		const { roomId } = message;
		if (roomId) {
			console.log(`Message received for room ${roomId}:`, message);
			socket.to(roomId).emit("message", message);
		} else {
			console.log("Room ID is missing in the message");
		}
	});
});

function error(err, req, res, next) {
	console.error(err.stack); // Log error stack
	res.status(500).json({ error: err.message });
}

app.use(error);

server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
