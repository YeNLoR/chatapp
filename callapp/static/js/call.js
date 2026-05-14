let peer = null;
let callSocket = null;
let activeCall = null;
let localStream = null;
let remoteUserId = null;

function connectCallSocket() {
  callSocket = new WebSocket("ws://" + window.location.host + "/ws/call/");

  callSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleSignal(data);
  };
}

function initPeer() {
  peer = new Peer();

  peer.on("open", (id) => {
    console.log("My Peer ID:", id);
    window._myPeerId = id;
  });

  peer.on("call", (incomingCall) => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStream = stream;
        showLocalStream(localStream);
        incomingCall.answer(stream);
        incomingCall.on("stream", showRemoteStream);
        activeCall = incomingCall;
        document.getElementById("incomingCallModal").close();
        document.getElementById("ongoingCallModal").showModal();
        document.getElementById("ongoingCallOpener").classList.toggle("hidden");
      });
  });
}

function showIncomingCallUI(data) {
  const incomingCallUI = document.getElementById("incomingCallModal");
  console.log(data);
  incomingCallUI.querySelector("#callerUsername").textContent =
    data.from_username;
  ((incomingCallUI.querySelector("#incomingCallAccept").onclick = () =>
    acceptCall(data.from_user_id)),
    incomingCallUI.showModal());
  document.getElementById("endOngoingCall").onclick = () => {
    endCall();
    document.getElementById("ongoingCallModal").close();
  };
}

function handleSignal(data) {
  switch (data.signal_type) {
    case "call.offer":
      remoteUserId = data.from_user_id;
      showIncomingCallUI(data);
      break;

    case "call.answer":
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          localStream = stream;
          showLocalStream(stream);
          activeCall = peer.call(data.peer_id, stream);
          activeCall.on("stream", showRemoteStream);
          document.getElementById("ongoingCallModal").showModal();
          document
            .getElementById("ongoingCallOpener")
            .classList.toggle("hidden");
        });
      break;

    case "call.reject":
      alert("Call was rejected.");
      cleanup();
      break;

    case "call.end":
      remoteUserId = null;
      cleanup();
      break;
  }
}

function callUser(targetUserId) {
  remoteUserId = targetUserId;
  callSocket.send(
    JSON.stringify({
      type: "call.offer",
      target_user_id: targetUserId,
      peer_id: window._myPeerId,
    }),
  );
  document.getElementById("endOngoingCall").onclick = () => {
    endCall();
    document.getElementById("ongoingCallModal").close();
  };
}

function acceptCall(fromUserId) {
  console.log("test");
  callSocket.send(
    JSON.stringify({
      type: "call.answer",
      target_user_id: fromUserId,
      peer_id: window._myPeerId,
    }),
  );
}

function rejectCall() {
  if (remoteUserId) {
    callSocket.send(
      JSON.stringify({
        type: "call.reject",
        target_user_id: remoteUserId,
      }),
    );
  }
  document.getElementById("incomingCallModal").close();
  remoteUserId = null;
}

function endCall() {
  callSocket.send(
    JSON.stringify({
      type: "call.end",
      target_user_id: remoteUserId,
    }),
  );
  cleanup();
  remoteUserId = null;
}

function showLocalStream(stream) {
  document.getElementById("localVideo").srcObject = stream;
}

function showRemoteStream(stream) {
  document.getElementById("remoteVideo").srcObject = stream;
}

function cleanup() {
  if (activeCall) activeCall.close();
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  document.getElementById("incomingCallModal").close();
  document.getElementById("ongoingCallModal").close();
  document.getElementById("ongoingCallOpener").classList.add("hidden");
  activeCall = null;
  localStream = null;
}

connectCallSocket();
initPeer();

function toggleAudio() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      console.log(audioTrack.enabled ? "Audio Enabled" : "Audio Muted");

      const button = document.getElementById("ongoingMic");
      button.classList.toggle("btn-success");
      button.classList.toggle("btn-error");
    }
  }
}

function toggleVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      console.log(videoTrack.enabled ? "Video Enabled" : "Video Disabled");

      const button = document.getElementById("ongoingCam");
      button.classList.toggle("btn-success");
      button.classList.toggle("btn-error");
    }
  }
}
