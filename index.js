const events = [];

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

let client;
const inputBindings = (bind, send) => {
	bind("keydown", e =>   send({ time: Date.now(), client, key: e.code, pressed: true }));
	bind("keyup", e =>     send({ time: Date.now(), client, key: e.code, pressed: false }));
	bind("mousedown", e => send({ time: Date.now(), client, mouse: e.button, pressed: true }));
	bind("mouseup", e =>   send({ time: Date.now(), client, mouse: e.button, pressed: false }));
	bind("mousemove", e => send({ time: Date.now(), client, move: [e.movementX, e.movementY] }));
};

// this promise waits for the ICE negotiation to finish before returning the local description
const waitForIce = connection => new Promise(callback => {
	connection.addEventListener("icecandidate", e => {
		if (e.candidate === null && connection.localDescription) {
			callback(connection.localDescription);
		}
	});
});

const server = { connections: [], channels: [] };

// creates the local client for the hosting player
const createServer = async () => await serverConnect(await createClient(await serverAddClient()));

// creates a connection object and sets it up
const serverAddClient = async () => {
	const connection = new RTCPeerConnection();
	const channel = connection.createDataChannel("events");
	channel.addEventListener("message", e => {
		for (const channel of server.channels)
			if (channel.readyState === "open") channel.send(e.data);
	});	
	await connection.setLocalDescription(await connection.createOffer());
	const offer = { type: "offer", client: server.connections.length };
	offer.sdp = (await waitForIce(connection)).sdp
	server.connections.push(connection);
	server.channels.push(channel);
	return JSON.stringify(offer);
};

// closes a specified connection object
const serverRemoveClient = client => server.connections[client].close();

// takes an answer from a client and matches it to the right connection object
const serverConnect = async string => {
	const answer = JSON.parse(string);
	await server.connections[answer.client].setRemoteDescription(answer);
};

// takes an offer from one of the server's connection objects and returns an answer
const createClient = async string => {
	const offer = JSON.parse(string);
	client = offer.client;
	const connection = new RTCPeerConnection();
	connection.addEventListener("datachannel", e => {
		const c = e.channel;
		c.addEventListener("message", e => events.push(JSON.parse(e.data)));
		const send = message => c.send(JSON.stringify(message));
		c.addEventListener("open", () => inputBindings(document.addEventListener, send));
		c.addEventListener("close", () => inputBindings(document.removeEventListener, send));
	});
	await connection.setRemoteDescription(offer);
	await connection.setLocalDescription(await connection.createAnswer());
	return JSON.stringify({ type: "answer", client, sdp: (await waitForIce(connection)).sdp });
};
