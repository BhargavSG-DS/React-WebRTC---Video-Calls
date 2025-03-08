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

let pc;
let localStream = null;
let startButton = null;
let hangupButton = null;
let muteAudioButton = null;
let remoteVideo = null;
let localVideo = null;

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

const roomId = uuidv4(); // Replace with actual room ID

function App() {
	startButton = useRef(null);
	hangupButton = useRef(null);
	muteAudioButton = useRef(null);
	localVideo = useRef(null);
	remoteVideo = useRef(null);
	const [audioState, setAudioState] = useState(false);
	const [room, setRoom] = useState(roomId);
	const socket = useRef(null);

	useEffect(() => {
		socket.current = io("http://localhost:3000", { transports: ["websocket"] });

		socket.current.on("connect", () => {
			console.log("Connected to server");
			socket.current.emit("join-room", room, socket.current.id);
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
					if (pc) {
						console.log("pc already exist");
						return;
					}
					makeCall();
					break;
				case "hangup":
					handleHangup();
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

		hangupButton.current.disabled = true;
		muteAudioButton.current.disabled = true;

		return () => {
			socket.current.disconnect();
		};
	}, [room]);

	async function handleOffer(e) {
		if (pc) {
			console.log("Exisiting peer connection found");
			return;
		}
		try {
			pc.onicecandidate = (e) => {
				const message = {
					type: "candidate",
					candidate: null,
					roomId: room,
				};
				if (e.candidate) {
					message.candidate = e.candidate.candidate;
					message.sdpMid = e.candidate.sdpMid;
					message.sdpMLineIndex = e.candidate.sdpMLineIndex;
				}
				socket.current.emit("message", message);
			};
			pc.ontrack = (e) => (remoteVideo.current.srcObject = e.streams[0]);
			localStream
				.getTracks()
				.forEach((track) => pc.addTrack(track, localStream));
			await pc.setRemoteDescription(e);

			const answer = await pc.createAnswer();
			socket.current.emit("message", { type: "answer", sdp: answer.sdp, roomId: room });
			await pc.setLocalDescription(answer);
		} catch (e) {
			console.log(e);
		}
	}

	async function handleAnswer(answer) {
		if (!pc) {
			console.log("No peer connection found");
			return;
		}
		try {
			await pc.setRemoteDescription(answer);
		} catch (e) {
			console.log(e);
		}
	}

	async function makeCall() {
		try {
			pc = new RTCPeerConnection(consfiguration);
			pc.onicecandidate = (e) => {
				const message = {
					type: "candidate",
					candidate: null,
					roomId: room,
				};
				if (e.candidate) {
					message.candidate = e.candidate.candidate;
					message.sdpMid = e.candidate.sdpMid;
					message.sdpMLineIndex = e.candidate.sdpMLineIndex;
				}
				socket.current.emit("message", message);
			};
			pc.ontrack = (e) => (remoteVideo.current.srcObject = e.streams[0]);
			localStream
				.getTracks()
				.forEach((track) => pc.addTrack(track, localStream));
			const offer = await pc.createOffer();
			socket.current.emit("message", { type: "offer", sdp: offer.sdp, roomId: room });
			await pc.setLocalDescription(offer);
		} catch (e) {
			console.log(e);
		}
	}

	async function handleHangup() {
		if (pc) {
			pc.close();
			pc = null;
		} else {
			localStream.getTracks().forEach((track) => track.stop());
			localStream = null;
			startButton.current.disabled = false;
			hangupButton.current.disabled = true;
			muteAudioButton.current.disabled = true;
		}
	}

	async function handleCandidate(candidate) {
		try {
			if (!pc) {
				console.log("No peer connection found");
				return;
			} else {
				await pc.addIceCandidate(candidate);
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

		startButton.current.disabled = true;
		hangupButton.current.disabled = false;
		muteAudioButton.current.disabled = false;
	};

	const hangB = async () => {
		handleHangup();
		socket.current.emit("message", { type: "hangup", roomId: room });
	};

	function muteAudio() {
		if (audioState) {
			localVideo.current.muted = true;
			setAudioState(false);
		} else {
			localVideo.current.muted = false;
			setAudioState(true);
		}
	}

	const joinRoom = (e) => {
		e.preventDefault();
		const roomIdInput = e.target.elements.roomId.value;
		setRoom(roomIdInput);
	};

	return (
		<>
			<main className="container">
				<form onSubmit={joinRoom}>
					<input type="text" name="roomId" placeholder="Enter Room ID" required />
					<button type="submit">Join Room</button>
				</form>
				<div className="video bg-main">
					<video
						ref={localVideo}
						className="video-item"
						autoPlay
						playsInline
						src=" "
					></video>
					<video
						ref={remoteVideo}
						className="video-item"
						autoPlay
						playsInline
						src=" "
					></video>
				</div>

				<div className="btn">
					<button
						className="btn-item btn-start"
						ref={startButton}
						onClick={startB}
					>
						<FiVideo />
					</button>
					<button
						className="btn-item btn-end"
						ref={hangupButton}
						onClick={hangB}
					>
						<FiVideoOff />
					</button>
					<button
						className="btn-item btn-start"
						ref={muteAudioButton}
						onClick={muteAudio}
					>
						{audioState ? <FiMic /> : <FiMicOff />}
					</button>
				</div>
			</main>
		</>
	);
}

export default App;
