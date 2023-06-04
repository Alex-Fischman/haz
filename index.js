const inputBindings = (bind, send) => {
	bind("keydown", e => send({ time: Date.now(), key: e.code, pressed: true }));
	bind("keyup", e => send({ time: Date.now(), key: e.code, pressed: false }));
	bind("mousedown", e => send({ time: Date.now(), mouse: e.button, pressed: true }));
	bind("mouseup", e => send({ time: Date.now(), mouse: e.button, pressed: false }));
	bind("mousemove", e => send({ time: Date.now(), move: [e.movementX, e.movementY] }));
};

const events = [];
inputBindings(document.addEventListener, event => events.push(event));

const log = document.getElementById("log");
const frame = () => {
	const now = Date.now();
	while (events.length && events[0].time < now - 1000) events.shift();

	log.innerText = "";
	for (const event of events) {
		if (event.key !== undefined) {
			log.innerText += (event.pressed ? "keydown: " : "keyup: ") + event.key + "\n";
		} else if (event.mouse !== undefined) {
			log.innerText += (event.pressed ? "mousedown: " : "mouseup: ") + event.mouse + "\n";
		} else if (event.move !== undefined) {
			log.innerText += "mousemove: " + event.move + "\n";
		} else {
			console.error("unknown event type: ", event);
		}
	}

	window.requestAnimationFrame(frame);
};
window.requestAnimationFrame(frame);

const CHANNEL_LABEL = "events";
const connect = (
	remoteDescription,
	onChannelOpened,
	onMessageReceived,
) => {
	const connection = new RTCPeerConnection();
	let channel;

	const createOffer = async () => {
		const offer = await connection.createOffer();
		connection.setLocalDescription(offer);
	};

	const createAnswer = async offer => {
		await connection.setRemoteDescription(JSON.parse(offer));
		const answer = await connection.createAnswer();
		connection.setLocalDescription(answer);
	};

	const setAnswer = answer => connection.setRemoteDescription(JSON.parse(answer));

	const setUpChannelAsAHost = () => {
		channel = connection.createDataChannel(CHANNEL_LABEL);
		channel.addEventListener("open", onChannelOpened);
		channel.addEventListener("message", e => onMessageReceived(e.data));
	};

	const setUpChannelAsAClient = () => {
		connection.addEventListener("datachannel", e => {
			channel = e.channel;
			channel.addEventListener("open", onChannelOpened);
			channel.addEventListener("message", e => onMessageReceived(e.data));
		});
	};

	const sendMessage = message => {
		if (channel) channel.send(message);
	};

	return new Promise(callback => {
		connection.addEventListener("icecandidate", e => {
			if (e.candidate === null && connection.localDescription) {
				connection.localDescription.sdp.replace("b=AS:30", "b=AS:1638400"); // TODO: ??
				callback({
					localDescription: JSON.stringify(connection.localDescription),
					setAnswer,
					sendMessage,
				});
			}
		});

		if (!remoteDescription) {
			setUpChannelAsAHost();
			createOffer();
		} else {
			setUpChannelAsAClient();
			createAnswer(remoteDescription);
		}
	});
};
