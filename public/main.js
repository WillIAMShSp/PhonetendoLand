"use strict";

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
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

var sendChannel;
var receiveChannel;

var pcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
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

socket.on("log", function (array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log("Client sending message: ", message);
  socket.emit("message", message);
}

// This client receives a message
socket.on("message", function (message) {
  console.log("Client received message:", message);
  if (message === "got user media") {
    maybeStart();
  } else if (message.type === "offer") {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === "answer" && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === "candidate" && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });
    pc.addIceCandidate(candidate);
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

function padButtonEventListenerAssignment(button, buttonValue) {
  button.addEventListener("touchstart", () => {
    f_buttonClick(buttonValue, true);
  });

  button.addEventListener("touchend", () => {
    f_buttonClick(buttonValue, false);
  });
}

function f_buttonClick(button, pressed) {
  sendChannel.send("SENT!");

  socket.emit("controllerInput", [button, pressed]);
}

function f_startButton() {
  if (isInitiator) {
    console.log("HELLO");
    navigator.mediaDevices
      .getDisplayMedia({
        audio: false,
        video: {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },

          frameRate: { ideal: 60, max: 60 },
        },
      })
      .then(gotStream)
      .catch(function (e) {
        alert("getDisplayMedia() error: " + e.name);
      });
  } else {
    sendMessage("got user media");
    socket.emit("controllerStart");
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

padButtonEventListenerAssignment(dPadUp, buttonAtlas.DPAD_UP);
padButtonEventListenerAssignment(dPadDown, buttonAtlas.DPAD_DOWN);
padButtonEventListenerAssignment(dPadLeft, buttonAtlas.DPAD_LEFT);
padButtonEventListenerAssignment(dPadRight, buttonAtlas.DPAD_RIGHT);
function triggerDemoVibration() {
  console.log("Vibrate button pressed");

  if ("vibrate" in navigator) {
    navigator.vibrate(200);
    console.log("Vibration triggered");
  } else {
    console.log("Vibration not supported");
  }
}

const vibrateBtn = document.getElementById("vibrateBtn");

if (vibrateBtn) {
  vibrateBtn.addEventListener("click", triggerDemoVibration);
}

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
    if (isInitiator) {
      pc.addStream(localStream);
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
    pc.onaddstream = handleRemoteStreamAdded;
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
      parameters.encodings[0].maxBitrate = 1500000;

      videoSender
        .setParameters(parameters)
        .then(() => {
          console.log("Successfully limited video bitrate to 1.5 Mbps");
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
  console.log("Remote stream added.");
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
  remoteVideo.play().then(() => {
    if ("playoutDelayHint" in remoteVideo) {
      remoteVideo.playoutDelayHint = 0;
    }
  });
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
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}
