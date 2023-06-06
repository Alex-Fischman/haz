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
			callback(JSON.stringify(connection.localDescription));
		}
	});
});

const server = {};

const createServer = async clients => {
	server.connections = [];
	server.channels = [];
	for (let i = 0; i < clients; i++) {
		const connection = new RTCPeerConnection();
		const channel = connection.createDataChannel("events");
		channel.addEventListener("message", e => {
			for (const channel of server.channels)
				if (channel.readyState === "open") channel.send(e.data);
		});
		
		server.connections.push(connection);
		server.channels.push(channel);
	}

	for (let i = 0; i < clients; i++) {
		const connection = server.connections[i];
		await connection.setLocalDescription(await connection.createOffer());
		if (i === 0) {
			const answer = await createClient(await waitForIce(connection), i);
			await serverAccept(answer, i);
		} else {
			console.log("offer for client " + i);
			console.log(JSON.stringify(await waitForIce(connection)));
		}
	}
};

const createClient = async (offer, i) => {
	client = i;
	const connection = new RTCPeerConnection();
	connection.addEventListener("datachannel", e => {
		const c = e.channel;
		c.addEventListener("message", e => events.push(JSON.parse(e.data)));
		const send = message => c.send(JSON.stringify(message));
		c.addEventListener("open", () => inputBindings(document.addEventListener, send));
		c.addEventListener("close", () => inputBindings(document.removeEventListener, send));
	});
	await connection.setRemoteDescription(JSON.parse(offer));
	await connection.setLocalDescription(await connection.createAnswer());
	return await waitForIce(connection);
};

const serverAccept = async (answer, i) => {
	await server.connections[i].setRemoteDescription(JSON.parse(answer));
};
