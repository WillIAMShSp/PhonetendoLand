import { WebHaptics, defaultPatterns } from "web-haptics";
import nipplejs from "nipplejs";

const haptics = new WebHaptics({
  debug: true,
});

const buttonAtlas = {
  DPAD_UP: 0x0001,
  DPAD_DOWN: 0x0002,
  DPAD_LEFT: 0x0004,
  DPAD_RIGHT: 0x0008,
  START: 0x0010,
  BACK: 0x0020,
  LEFT_THUMB: 0x0040,
  RIGHT_THUMB: 0x0080,
  LEFT_SHOULDER: 0x0100,
  RIGHT_SHOULDER: 0x0200,
  GUIDE: 0x0400,
  A: 0x1000,
  B: 0x2000,
  X: 0x4000,
  Y: 0x8000,
};

document.addEventListener("gesturestart", function (e) {
  e.preventDefault();
});

var isChannelReady = false;
var isInitiator = false;
var isGamePad = false;
var isController = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

var sendChannel;
var receiveChannel;
var audioCtx;

var pcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};

var sdpDataConstraint = null;

/////////////////////////////////////////////

var room = prompt("Enter your room name", "default");

var socket = io.connect();

if (room !== "") {
  socket.emit("create or join", room);
  console.log("Attempted to create or  join room", room);
}

socket.on("created", function (room) {
  console.log("Created room " + room);
  isInitiator = true;
});

socket.on("full", function (room) {
  console.log("Room " + room + " is full");
});

socket.on("join", function (room) {
  console.log("Another peer made a request to join room " + room);
  console.log("This peer is the initiator of room " + room + "!");
  isChannelReady = true;
});

socket.on("joined", function (room) {
  console.log("joined: " + room);
  isChannelReady = true;
});

socket.on("gamepad", function () {
  console.log("This peer is the gamepad!");
  isGamePad = true;
});

socket.on("controller", function () {
  console.log("This peer is a controller");
  isController = true;
});

socket.on("log", function (array) {
  console.log.apply(console, array);
});

socket.on("vibrate", function () {
  console.log("Should be vibrating!!");
  //haptics.trigger(defaultPatterns.buzz);
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const duration = 500 / 1000;

  const carrier1 = audioCtx.createOscillator();
  carrier1.type = "sine";
  carrier1.frequency.setValueAtTime(42, now);

  // Carrier 2: Low 48Hz sawtooth (adds mechanical grit and creates 6Hz acoustic "beating")
  const carrier2 = audioCtx.createOscillator();
  carrier2.type = "sawtooth";
  carrier2.frequency.setValueAtTime(48, now);

  // --- 2. Tremolo / Motor Chopper (LFO) ---
  // Chops the volume 20 times per second to mimic an off-center motor spinning
  const tremoloLFO = audioCtx.createOscillator();
  tremoloLFO.type = "sine";
  tremoloLFO.frequency.setValueAtTime(22, now); // 22Hz tremor rate

  const tremoloGain = audioCtx.createGain();
  tremoloGain.gain.setValueAtTime(0.5, now); // Depth of chopping effect

  tremoloLFO.connect(tremoloGain.gain);

  // --- 3. Low Pass Filter ---
  // Keeps the mechanical physical energy while cutting high audio whines
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(110, now);

  // --- 4. Master Volume Envelope ---
  const masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.01, now);
  // Quick 30ms ramp up so it starts smoothly without an abrupt pop
  masterGain.gain.exponentialRampToValueAtTime(1.2, now + 0.03);

  // --- 5. Connect Signal Chain ---
  carrier1.connect(tremoloGain);
  carrier2.connect(tremoloGain);
  tremoloGain.connect(filter);
  filter.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  // Start Oscillators
  carrier1.start(now);
  carrier2.start(now);
  tremoloLFO.start(now);

  // --- 6. Handle Stopping ---
  if (duration > 0) {
    // Fade out smoothly at the end instead of stopping abruptly
    const stopTime = now + duration;
    masterGain.gain.setValueAtTime(1.2, stopTime - 0.05);
    masterGain.gain.exponentialRampToValueAtTime(0.001, stopTime);

    carrier1.stop(stopTime);
    carrier2.stop(stopTime);
    tremoloLFO.stop(stopTime);
  }
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log("Client sending message: ", message);
  socket.emit("message", message);
}

var pendingCandidates = [];

async function processPendingCandidates() {
  while (pendingCandidates.length > 0) {
    const candidate = pendingCandidates.shift();
    try {
      await pc.addIceCandidate(candidate);
    } catch (e) {
      console.error("Error adding queued candidate", e);
    }
  }
}

// This client receives a message
socket.on("message", async function (message) {
  console.log("Client received message:", message);
  if (message === "got user media") {
    maybeStart();
  } else if (message.type === "offer") {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }

    if (pc && pc.signalingState !== "closed") {
      await pc.setRemoteDescription(new RTCSessionDescription(message));
      await processPendingCandidates();
      doAnswer();
    }
  } else if (message.type === "answer") {
    if (pc && pc.signalingState === "have-local-offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(message));
    } else {
      console.warn(
        "Ignored remote answer because signalingState is:",
        pc?.signalingState,
      );
    }
  } else if (message.type === "candidate" && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });

    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error("Error adding candidate!", error);
      }
    } else {
      pendingCandidates.push(candidate);
    }
  } else if (message === "bye" && isStarted) {
    handleRemoteHangup();
  }
});
////////////////////////////////////////////////////

var localVideo = document.querySelector("#localVideo");
var remoteVideo = document.querySelector("#remoteVideo");

var startButton = document.getElementById("btnStart");
var endButton = document.getElementById("btnEnd");

// 1 and 2 buttons
var xButton = document.getElementById("btnX");
var aButton = document.getElementById("btnA");

// dpad buttons :)
var dPadUp = document.getElementById("btnUp");
var dPadDown = document.getElementById("btnDown");
var dPadLeft = document.getElementById("btnLeft");
var dPadRight = document.getElementById("btnRight");

function getJoystickSize() {
  // Example: 20% of the viewport width, but clamped between 150px and 400px
  const calculatedSize = window.innerWidth * 0.2;
  return Math.min(Math.max(calculatedSize, 150), 400);
}

const joystick = nipplejs.create({
  zone: document.getElementById("joystick"),
  mode: "static",
  position: { left: "50%", top: "50%" },
  size: getJoystickSize(),
  color: {
    front: "rgba(255, 255, 255, 0.3)",
    back: "radial-gradient(circle, rgba(0,0,0,0.2), transparent)",
  },
});

joystick.on("move", (evt) => {
  socket.emit("controllerAnalog", evt.data.vector);
});

joystick.on("end", (evt) => {
  socket.emit("controllerAnalog", { x: 0, y: 0 });
});

function padButtonEventListenerAssignment(button, buttonValue) {
  button.addEventListener("touchstart", () => {
    f_buttonClick(buttonValue, true);
  });

  button.addEventListener("touchend", () => {
    f_buttonClick(buttonValue, false);
  });
}

function f_buttonClick(button, pressed) {
  socket.emit("controllerInput", [button, pressed]);
}

function f_startButton() {
  if (isController) {
    socket.emit("controllerStart");
    audioCtx = new (
      window.AudioContext || window.webkitAudiowebkitAudioContext
    )();
    return;
  }

  if (isInitiator) {
    console.log("HELLO");
    navigator.mediaDevices
      .getDisplayMedia({
        audio: false,
        video: {
          width: { ideal: window.innerWidth },
          height: { ideal: window.innerHeight },
          latency: { max: 0 },
          frameRate: { ideal: 60, max: 60 },
          displaySurface: "monitor",
        },
      })
      .then(gotStream)
      .catch(function (e) {
        alert("getDisplayMedia() error: " + e.name);
      });
  } else {
    sendMessage("got user media");
    socket.emit("controllerStart");
    audioCtx = new (
      window.AudioContext || window.webkitAudiowebkitAudioContext
    )();
  }
}

function f_endButton() {
  if (!isInitiator) {
    socket.emit("controllerEnd");
  }
  hangup();
}

startButton.addEventListener("click", f_startButton);
endButton.addEventListener("click", f_endButton);

padButtonEventListenerAssignment(xButton, buttonAtlas.X);
padButtonEventListenerAssignment(aButton, buttonAtlas.A);

// padButtonEventListenerAssignment(dPadUp, buttonAtlas.DPAD_UP);
// padButtonEventListenerAssignment(dPadDown, buttonAtlas.DPAD_DOWN);
// padButtonEventListenerAssignment(dPadLeft, buttonAtlas.DPAD_LEFT);
// padButtonEventListenerAssignment(dPadRight, buttonAtlas.DPAD_RIGHT);

function triggerDemoVibration() {
  console.log("Vibrate button pressed");

  haptics.trigger(defaultPatterns.buzz);
}

const vibrateBtn = document.getElementById("vibrateBtn");

vibrateBtn.addEventListener("click", triggerDemoVibration);

function gotStream(stream) {
  console.log("Adding local stream.");
  localStream = stream;
  localVideo.srcObject = null;
  sendMessage("got user media");
  if (!isInitiator) {
    localVideo.classList.add("hidden");
  } else {
    localVideo.classList.add("hidden");
    maybeStart();
  }
}

var constraints = {
  video: true,
};

console.log("Getting user media with constraints", constraints);

function maybeStart() {
  console.log(">>>>>>> maybeStart() ", isStarted, localStream, isChannelReady);
  if (!isStarted && isChannelReady) {
    console.log(">>>>>> creating peer connection");
    createPeerConnection();
    if (isInitiator && localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
      // const transceiver = pc
      //   .getTransceivers()
      //   .find((t) => t.sender.track && t.sender.track.kind === "video");

      // if (transceiver && "setCodecPreferences" in transceiver) {
      //   const codecs = RTCRtpReceiver.getCapabilities("video").codecs;
      //   const h264Codecs = codecs.filter((c) => c.mimeType === "video/H264");

      //   if (h264Codecs.length > 0) {
      //     transceiver.setCodecPreferences(h264Codecs);
      //     console.log("Successfully prioritized H.264 codec");
      //   }
      // }
    }
    sendChannel = pc.createDataChannel("sendDataChannel", sdpDataConstraint);
    isStarted = true;
    console.log("isInitiator", isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function () {
  sendMessage("bye");
};

/////////////////////////////////////////////////////////

function onRecieveMessage(message) {
  console.log("recieved message");
  console.log(message);
}

function onRecieveChannel(event) {
  console.log("recievedChannel");
  receiveChannel = event.channel;
  receiveChannel.onmessage = onRecieveMessage;
}

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.ontrack = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    pc.ondatachannel = onRecieveChannel;

    console.log("Created RTCPeerConnnection");
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }
}

function handleIceCandidate(event) {
  console.log("icecandidate event: ", event);
  if (event.candidate) {
    sendMessage({
      type: "candidate",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
    });
  } else {
    console.log("End of candidates.");
  }
}

function handleCreateOfferError(event) {
  console.log("createOffer() error: ", event);
}

function doCall() {
  console.log("Sending offer to peer");
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log("Sending answer to peer.");
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError,
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log("setLocalAndSendMessage sending message", sessionDescription);

  if (
    sessionDescription.type === "offer" ||
    sessionDescription.type === "answer"
  ) {
    const senders = pc.getSenders();
    const videoSender = senders.find(
      (sender) => sender.track && sender.track.kind === "video",
    );

    if (videoSender) {
      const parameters = videoSender.getParameters();

      // Make sure the encodings array exists
      if (!parameters.encodings || parameters.encodings.length === 0) {
        parameters.encodings = [{}];
      }

      // 1,500,000 bits per second = 1.5 Mbps
      parameters.encodings[0].maxBitrate = 3000000;

      parameters.degradationPreference = "maintain-framerate";

      videoSender
        .setParameters(parameters)
        .then(() => {
          console.log("Successfully limited video bitrate to 3 Mbps");
        })
        .catch((err) => {
          console.error("Could not limit bitrate via setParameters:", err);
        });
    }
  }

  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace("Failed to create session description: " + error.toString());
}

function handleRemoteStreamAdded(event) {
  if (!isGamePad) {
    return;
  }

  console.log("Remote stream added.");
  if (remoteVideo.srcObject !== event.streams[0]) {
    remoteVideo.srcObject = event.streams[0];
    remoteVideo
      .play()
      .then(() => {
        if ("playoutDelayHint" in remoteVideo) {
          remoteVideo.playoutDelayHint = 0;
        }
      })
      .catch((e) => console.error("Error playing video:", e));
  }
}

function handleRemoteStreamRemoved(event) {
  console.log("Remote stream removed. Event: ", event);
}

function hangup() {
  console.log("Hanging up.");
  stop();
  sendMessage("bye");
}

function handleRemoteHangup() {
  console.log("Session terminated.");
  socket.emit("controllerEnd");
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;

  if (sendChannel) {
    sendChannel.close();
    sendChannel = null;
  }
  if (receiveChannel) {
    receiveChannel.close();
    receiveChannel = null;
  }
  if (pc) {
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.close();
    pc = null;
  }
}
