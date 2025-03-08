import { io } from "socket.io-client";
import { useRef, useEffect, useState } from "react";

import "./App.css";
import { FiVideo, FiVideoOff, FiMic, FiMicOff } from "react-icons/fi";

const consfiguration = {
	iceServers: [
		{
			urls: [
				"stun:stun1.l.google.com:19302",
				"stun:stun2.l.google.com:19302",
			],
		},
	],
	iceCandidatePoolSize: 10,
};

let pcs = {}; // Store peer connections for each user
let localStream = null;
let remoteVideo = null;
let localVideo = null;

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

const roomId = uuidv4(); // Replace with actual room ID

function App() {
	const startButton = useRef(null);
	const hangupButton = useRef(null);
	const muteAudioButton = useRef(null);
	localVideo = useRef(null);
	remoteVideo = useRef(null);
	const [audioState, setAudioState] = useState(false);
	const [room, setRoom] = useState(null);
	const [inCall, setInCall] = useState(false);
	const socket = useRef(null);

	useEffect(() => {
		socket.current = io("http://localhost:3000", { transports: ["websocket"] });

		socket.current.on("connect", () => {
			console.log("Connected to server");
			if (room) {
				socket.current.emit("join-room", room, socket.current.id);
			}
		});

		socket.current.on("user-connected", (userId) => {
			console.log(`User connected: ${userId}`);
			createPeerConnection(userId);
		});

		socket.current.on("user-disconnected", (userId) => {
			console.log(`User disconnected: ${userId}`);
			if (pcs[userId]) {
				pcs[userId].close();
				delete pcs[userId];
			}
		});

		socket.current.on("message", (e) => {
			if (!localStream) {
				console.log("not ready yet");
				return;
			}

			switch (e.type) {
				case "offer":
					handleOffer(e);
					break;
				case "answer":
					handleAnswer(e);
					break;
				case "candidate":
					handleCandidate(e);
					break;
				case "ready":
					if (pcs[e.userId]) {
						console.log("pc already exist");
						return;
					}
					makeCall(e.userId);
					break;
				case "hangup":
					handleHangup(e.userId);
					break;
				default:
					console.log("unknown message type");
					break;
			}
		});

		socket.current.on("disconnect", () => {
			console.log("Socket disconnected, attempting to reconnect...");
			socket.current.connect();
		});

		return () => {
			socket.current.disconnect();
		};
	}, [room]);

	function createPeerConnection(userId) {
		const pc = new RTCPeerConnection(consfiguration);
		pc.onicecandidate = (e) => {
			const message = {
				type: "candidate",
				candidate: null,
				roomId: room,
				userId: userId,
			};
			if (e.candidate) {
				message.candidate = e.candidate.candidate;
				message.sdpMid = e.candidate.sdpMid;
				message.sdpMLineIndex = e.candidate.sdpMLineIndex;
			}
			socket.current.emit("message", message);
		};
		pc.ontrack = (e) => {
			const remoteVideoElement = document.createElement("video");
			remoteVideoElement.srcObject = e.streams[0];
			remoteVideoElement.autoplay = true;
			remoteVideoElement.playsInline = true;
			document.querySelector(".video").appendChild(remoteVideoElement);
		};
		localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
		pcs[userId] = pc;
	}

	async function handleOffer(e) {
		const { userId, sdp } = e;
		if (pcs[userId]) {
			console.log("Existing peer connection found");
			return;
		}
		createPeerConnection(userId);
		try {
			await pcs[userId].setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));
			const answer = await pcs[userId].createAnswer();
			await pcs[userId].setLocalDescription(answer);
			socket.current.emit("message", { type: "answer", sdp: answer.sdp, roomId: room, userId: userId });
		} catch (e) {
			console.log(e);
		}
	}

	async function handleAnswer(e) {
		const { userId, sdp } = e;
		if (!pcs[userId]) {
			console.log("No peer connection found");
			return;
		}
		try {
			await pcs[userId].setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }));
		} catch (e) {
			console.log(e);
		}
	}

	async function makeCall(userId) {
		try {
			createPeerConnection(userId);
			const offer = await pcs[userId].createOffer();
			await pcs[userId].setLocalDescription(offer);
			socket.current.emit("message", { type: "offer", sdp: offer.sdp, roomId: room, userId: userId });
		} catch (e) {
			console.log(e);
		}
	}

	async function handleHangup(userId) {
		if (pcs[userId]) {
			pcs[userId].close();
			delete pcs[userId];
		}
	}

	async function handleCandidate(e) {
		const { userId, candidate } = e;
		try {
			if (!pcs[userId]) {
				console.log("No peer connection found");
				return;
			} else {
				await pcs[userId].addIceCandidate(new RTCIceCandidate(candidate));
			}
		} catch (e) {
			console.log(e);
		}
	}

	const startB = async () => {
		try {
			localStream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: { echoCancellation: true },
			});
			localVideo.current.srcObject = localStream;
		} catch (e) {
			console.log(e);
		}

		setInCall(true);
	};

	const hangB = async () => {
		handleHangup();
		socket.current.emit("message", { type: "hangup", roomId: room });
	};

	function muteAudio() {
		if (audioState) {
			localStream.getAudioTracks()[0].enabled = false;
			setAudioState(false);
		} else {
			localStream.getAudioTracks()[0].enabled = true;
			setAudioState(true);
		}
	}

	const joinRoom = async (e) => {
		e.preventDefault();
		const roomIdInput = e.target.elements.roomId.value;
		setRoom(roomIdInput);
		await startB(); // Ensure the startB function is called to initialize the local stream
	};

	const startRoom = async () => {
		const newRoomId = uuidv4();
		setRoom(newRoomId);
		socket.current.emit("join-room", newRoomId, socket.current.id);
		await startB(); // Ensure the startB function is called to initialize the local stream
	};

	return (
		<>
			<main className="container">
				{!inCall && (
					<>
						<form onSubmit={joinRoom}>
							<input type="text" name="roomId" placeholder="Enter Room ID" required />
							<button type="submit">Join Room</button>
						</form>
						<button onClick={startRoom}>Start a Call Room</button>
					</>
				)}
				<div className="video bg-main">
					<video
						ref={localVideo}
						className="video-item"
						autoPlay
						playsInline
						muted // Ensure local video is muted to avoid feedback
					></video>
					<video
						ref={remoteVideo}
						className="video-item"
						autoPlay
						playsInline
					></video>
				</div>

				{inCall && (
					<div className="btn">
						<button
							className="btn-item btn-start"
							ref={startButton}
							onClick={startB}
							disabled={inCall}
						>
							<FiVideo />
						</button>
						<button
							className="btn-item btn-end"
							ref={hangupButton}
							onClick={hangB}
							disabled={!inCall}
						>
							<FiVideoOff />
						</button>
						<button
							className="btn-item btn-start"
							ref={muteAudioButton}
							onClick={muteAudio}
							disabled={!inCall}
						>
							{audioState ? <FiMic /> : <FiMicOff />}
						</button>
					</div>
				)}
			</main>
		</>
	);
}

export default App;
