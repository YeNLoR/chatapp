let peer = null;
let callSocket = null;
let activeCall = null;
let localStream = null;

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
    endCall(data.target_user_id);
    document.getElementById("ongoingCallModal").close();
  };
}

function handleSignal(data) {
  switch (data.signal_type) {
    case "call.offer":
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
        });
      break;

    case "call.reject":
      alert("Call was rejected.");
      cleanup();
      break;

    case "call.end":
      cleanup();
      break;
  }
}

function callUser(targetUserId) {
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

function endCall(targetUserId) {
  callSocket.send(
    JSON.stringify({
      type: "call.end",
      target_user_id: targetUserId,
    }),
  );
  cleanup();
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
  activeCall = null;
  localStream = null;
}

connectCallSocket();
initPeer();
