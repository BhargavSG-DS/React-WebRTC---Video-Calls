require("dotenv").config();

const express = require("express"); // Import express

const app = express(); // Create express app

app.use(cors()); // Enable CORS

const server = require("http").createServer(app); // Create HTTP server

const io = require("socket.io")(server, {
	cors: { origin: "http://127.0.0.1/:5173" },
}); // Create socket.io server

const PORT = 3000 || process.env.PORT; // Set port

io.on("connection", (socket) => {
	console.log("New user connected");

	socket.on("join-room", (roomId, userId) => {
		socket.join(roomId);

		socket.to(roomId).broadcast.emit("user-connected", userId);

		socket.on("disconnect", () => {
			socket.to(roomId).broadcast.emit("user-disconnected", userId);
		});
	});
});

function error(err, req, res, next) {
	if (!test) console.log(err.stack);

	// respond with 500 "Internal Server Error".
	res.status(500);
	res.json({ error: err });
}

app.use(error);
server.listen(3000, () => {
	console.log(`Server running on port ${PORT}`); // Listen on port
});
