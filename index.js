const events = [];

const inputBindings = (bind, send) => {
	bind("keydown", e => send({ time: Date.now(), key: e.code, pressed: true }));
	bind("keyup", e => send({ time: Date.now(), key: e.code, pressed: false }));
	bind("mousedown", e => send({ time: Date.now(), mouse: e.button, pressed: true }));
	bind("mouseup", e => send({ time: Date.now(), mouse: e.button, pressed: false }));
	bind("mousemove", e => send({ time: Date.now(), move: [e.movementX, e.movementY] }));
};

const channelBindings = channel => {
	const send = message => {
		events.push(message);
		channel.send(JSON.stringify(message));
	};
	channel.addEventListener("message", e => events.push(JSON.parse(e.data)));

	channel.addEventListener("open", () => inputBindings(document.addEventListener, send));
	channel.addEventListener("close", () => inputBindings(document.removeEventListener, send));
};

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

const connection = new RTCPeerConnection();

// this promise waits for the ICE negotiation to finish before returning the local description
const waitForIce = new Promise(callback => {
	connection.addEventListener("icecandidate", e => {
		if (e.candidate === null && connection.localDescription) {
			callback(JSON.stringify(connection.localDescription));
		}
	});
});

const hostBroadcast = async () => {
	channelBindings(connection.createDataChannel(CHANNEL_LABEL));

	await connection.setLocalDescription(await connection.createOffer());
	return waitForIce;
};

const clientBounce = async offer => {
	connection.addEventListener("datachannel", e => channelBindings(e.channel));
	await connection.setRemoteDescription(JSON.parse(offer));
	await connection.setLocalDescription(await connection.createAnswer());
	return waitForIce;
};

const hostReceive = answer => connection.setRemoteDescription(JSON.parse(answer));
