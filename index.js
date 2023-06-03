const connection = new RTCPeerConnection();
const channel = connection.createDataChannel("events");

const keydown = event =>
	channel.send({ time: Date.now(), key: event.key, pressed: true });
const keyup = event =>
	channel.send({ time: Date.now(), key: event.key, pressed: false })
const mousedown = event =>
	channel.send({ time: Date.now(), mouse: event.button, pressed: true });
const mouseup = event =>
	channel.send({ time: Date.now(), mouse: event.button, pressed: false });
const mousemove = event =>
	channel.send({ time: Date.now(), move: [event.movementX, event.movementY] });

channel.addEventListener("open", event => {
	console.log("channel opened!");
	document.addEventListener("keydown", keydown);
	document.addEventListener("keyup", keyup);
	document.addEventListener("mousedown", mousedown);
	document.addEventListener("mouseup", mouseup);
	document.addEventListener("mousemove", mousemove);
});
channel.addEventListener("close", event => {
	console.log("channel closed!");
	document.removeEventListener("keydown", keydown);
	document.removeEventListener("keyup", keyup);
	document.removeEventListener("mousedown", mousedown);
	document.removeEventListener("mouseup", mouseup);
	document.removeEventListener("mousemove", mousemove);
});

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

connection.addEventListener("icecandidate", event =>
	console.log("ice", JSON.stringify(event.candidate))) // TODO

const hostBroadcast = () => connection
	.createOffer()
	.then(offer => connection.setLocalDescription(offer))
	.then(() => console.log(JSON.stringify(connection.localDescription)));

const clientBounce = hostDescription => connection
	.setRemoteDescription(hostDescription)
	.then(() => connection.addEventListener("datachannel", event =>
		event.channel.addEventListener("message", event =>
			events.push(event.data))))
	.then(() => connection.createAnswer())
	.then(answer => connection.setLocalDescription(answer))
	.then(() => console.log(JSON.stringify(connection.localDescription)));

const hostAccept = clientDescription => connection
	.setRemoteDescription(clientDescription)
	.then(() => console.log("connected"));
