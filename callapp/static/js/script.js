let chatSocket = null;
let peer = null;
let localStream = null;
let screenShare = false;
let camShare = false;
let connectTimer;
const activeCalls = {}; // Format: { peerId: callObject }
const userPeerMap = {}; // Format: { userId: peerId }
const messageTemplate = document.getElementById("messageTemplate");

function connectWebsocket() {
  const wsProtocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  chatSocket = new WebSocket(wsProtocol + window.location.host + "/");
  let pingTimer;
  chatSocket.onopen = () => {
    if (connectTimer) { clearTimeout(connectTimer) }
    if (pingTimer) {clearInterval(pingTimer)}
    pingTimer = setInterval(() => {
      chatSocket.send(JSON.stringify({type:"ping"}))
    },30000)
    const currentPath = window.location.pathname.trim().slice(1, -1);
    const currentPathArray = currentPath.split("/");
    if (currentPathArray.length === 3 && currentPathArray[0] === "channel") {
      joinTextChannel(currentPathArray[2]);
    }
    if (
      currentPathArray.length > 1 &&
      currentPathArray[0] === "channel" &&
      currentPathArray[1] !== "friends"
    ) {
      joinServerView(currentPathArray[1]);
    }
  };
  chatSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "new_message") {
      createMessage(data);
    } else if (["vc.state", "vc.joined", "vc.left"].includes(data.type)) {
      const currentPath = window.location.pathname.trim().slice(1, -1);
      const currentPathArray = currentPath.split("/");
      if (currentPathArray[1] == "friends") return;
      updateVC(data);
    } else if (data.type === "vc.invite") {
      showIncomingCall(data);
    } else {
      handleSignal(data);
    }
  };
  chatSocket.onclose = () => {
    if (pingTimer) clearInterval(pingTimer);
    connectTimer = setTimeout(() => { connectWebsocket() }, 5000) ;
  }
}

function showIncomingCall(data) {
  const incomingCallModal = document.getElementById("incomingCallModal");
  incomingCallModal.querySelector("#callerUsername").textContent =
    data.from.username;
  incomingCallModal.querySelector("#callerAvatar").src = data.from.avatar;
  incomingCallModal.querySelector("#incomingCallAccept").onclick = () => {
    startGroupCall(data.channel_id);
    incomingCallModal.close();
  };
  incomingCallModal.showModal();
}

function joinServerView(serverId) {
  chatSocket.send(
    JSON.stringify({
      type: "server_view.join",
      server_id: serverId,
    }),
  );
}

function leaveServerView() {
  chatSocket.send(JSON.stringify({ type: "server_view.leave" }));
}

function joinTextChannel(textChannelId) {
  chatSocket.send(
    JSON.stringify({
      type: "text_channel.join",
      text_channel: `${textChannelId}`,
    }),
  );
}

connectWebsocket();

function createMessage(data) {
  const clone = document.importNode(messageTemplate.content, true);
  let cloneImg = clone.querySelector("img");
  let cloneUsername = clone.querySelector("#messageTemplateUsername");
  let cloneMessage = clone.querySelector("#messageTemplateContent");
  cloneImg.src = data.avatar;
  cloneUsername.innerHTML = data.username;
  cloneMessage.innerHTML = data.message;
  document.getElementById("messages").appendChild(clone);
}

function callInvite(username, channelId) {
  chatSocket.send(
    JSON.stringify({
      type: "voice_channel.invite",
      username: username,
      channel_id: channelId,
    }),
  );
}

function updateVC(data) {
  function vcAddUser(channelId, username, avatar) {
    const div = document.createElement("div");
    const img = document.createElement("img");
    const span = document.createElement("span");
    div.id = `${channelId}_${username}`;
    div.className = "flex flex-row h-6 gap-1 w-full";
    img.className = "size-6";
    img.src = avatar;
    span.innerHTML = username;
    div.appendChild(img);
    div.appendChild(span);
    document.getElementById(channelId).appendChild(div);
  }
  if (data.type === "vc.joined") {
    vcAddUser(data.channel_id, data.username, data.avatar);
  } else if (data.type === "vc.left") {
    document.getElementById(`${data.channel_id}_${data.username}`)?.remove();
  } else if (data.type === "vc.state") {
    for (const channel in data) {
      if (channel === "type") {
        continue;
      }
      const channelId = channel;
      for (const user in data[channel]) {
        const username = user;
        const avatar = data[channel][username].avatar;
        vcAddUser(channelId, username, avatar);
      }
    }
  }
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-modal]")) {
    document
      .getElementById(
        event.target.closest("[data-modal]").getAttribute("data-modal"),
      )
      .showModal();
  }
});

document.addEventListener("htmx:afterRequest", (event) => {
  if (event.detail.elt.id === "messageForm") {
    event.detail.elt.querySelector("#messageInput").value = "";
    event.detail.elt.querySelector("#messageInput").focus();
  }
});

document.addEventListener("mouseover", (event) => {
  const tooltip = event.target.closest("[data-tooltip]");
  const tooltipCheck = tooltip?.querySelector("[data-is-tooltip]");
  if (tooltip && !tooltipCheck) {
    const tooltipText = tooltip.dataset.tooltip;
    const coords = tooltip.getBoundingClientRect();
    const posX = coords.right + window.scrollX + 10;
    const posY = coords.top + window.scrollY + coords.height / 2;
    const tooltipElement = document.createElement("span");
    tooltipElement.classList.add(
      "absolute",
      "bg-base-200",
      "border",
      "text-base",
      "p-1",
    );
    tooltipElement.textContent = tooltipText;
    tooltipElement.setAttribute("data-is-tooltip", "");
    document.body.append(tooltipElement);
    tooltipElement.style.left = `${posX}px`;
    tooltipElement.style.top = `${posY}px`;
    tooltipElement.style.transform = "translateY(-50%)";
    tooltip.addEventListener(
      "mouseout",
      () => {
        tooltipElement.remove();
      },
      { once: true },
    );
  }
});

async function getSafeLocalStream() {
  let audioStream;
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
  } catch (error) {
    console.warn(
      "Mikrofon bulunamadı, boş ses kanalı oluşturuluyor.",
      error.name,
    );
    try {
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const dst = audioContext.createMediaStreamDestination();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(dst);
      oscillator.start();
      audioStream = dst.stream;
    } catch (e) {
      console.error("AudioContext failed", e);
      audioStream = new MediaStream();
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 1, 1);
  }
  const canvasStream = canvas.captureStream(1);
  const dummyVideoTrack = canvasStream.getVideoTracks()[0];
  const finalStream = new MediaStream();
  if (audioStream.getAudioTracks()[0]) {
    finalStream.addTrack(audioStream.getAudioTracks()[0]);
  }
  if (dummyVideoTrack) {
    finalStream.addTrack(dummyVideoTrack);
  }
  return finalStream;
}

function showLocalStream(stream) {
  const localVideo = document.getElementById("localVideo");
  if (localVideo) localVideo.srcObject = stream;
}

async function startGroupCall(roomName) {
  localStream = await getSafeLocalStream();
  showLocalStream(localStream);
  initPeer(roomName);
  joinVoiceChannel(roomName);
  document.getElementById("ongoingCallModal").showModal();
}

function joinVoiceChannel(voiceChannelId) {
  chatSocket.send(
    JSON.stringify({
      type: "voice_channel.join",
      voice_channel: `${voiceChannelId}`,
    }),
  );
}

function initPeer(roomName) {
  peer = new Peer();
  peer.on("open", (id) => {
    window._myPeerId = id;
    chatSocket.send(
      JSON.stringify({
        type: "voice_channel.call",
        peer_id: id,
      }),
    );
  });
  peer.on("call", (incomingCall) => {
    incomingCall.answer(localStream);
    incomingCall.on("stream", (remoteStream) => {
      addRemoteVideo(incomingCall.peer, remoteStream);
    });
    incomingCall.on("close", () => {
      removeRemoteVideo(incomingCall.peer);
    });
    activeCalls[incomingCall.peer] = incomingCall;
  });
}

function handleSignal(data) {
  switch (data.type) {
    case "call.broadcast_joined":
      userPeerMap[data.user_id] = data.peer_id;
      if (data.peer_id !== window._myPeerId) {
        console.log(`Calling newly joined user: ${data.username}`);
        const call = peer.call(data.peer_id, localStream);
        call.on("stream", (remoteStream) => {
          addRemoteVideo(data.peer_id, remoteStream);
        });
        call.on("close", () => {
          removeRemoteVideo(data.peer_id);
        });
        activeCalls[data.peer_id] = call;
      }
      break;
    case "call.broadcast_left":
      console.log(`User ${data.user_id} left the room.`);
      const leftPeerId = userPeerMap[data.user_id];
      if (leftPeerId && activeCalls[leftPeerId]) {
        activeCalls[leftPeerId].close();
        delete activeCalls[leftPeerId];
        delete userPeerMap[data.user_id];
      }
      break;
  }
}
function addRemoteVideo(peerId, stream) {
  let videoElement = document.getElementById(`video-${peerId}`);
  if (!videoElement) {
    const grid = document.getElementById("videoGrid");
    const videoWrapper = document.createElement("div");
    videoWrapper.id = `wrapper-${peerId}`;
    videoWrapper.className = "video-container flex-1";
    videoElement = document.createElement("video");
    videoElement.id = `video-${peerId}`;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoWrapper.appendChild(videoElement);
    grid.appendChild(videoWrapper);
  }
  videoElement.srcObject = stream;
}

function removeRemoteVideo(peerId) {
  const wrapper = document.getElementById(`wrapper-${peerId}`);
  if (wrapper) wrapper.remove();
}

function leaveCall() {
  chatSocket.send(JSON.stringify({ type: "voice_channel.leave" }));
  Object.keys(activeCalls).forEach((peerId) => {
    activeCalls[peerId].close();
    removeRemoteVideo(peerId);
  });
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
  }
  Object.keys(activeCalls).forEach((k) => delete activeCalls[k]);
  Object.keys(userPeerMap).forEach((k) => delete userPeerMap[k]);
  localStream = null;
}

function toggleAudio() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      console.log(audioTrack.enabled ? "Audio Enabled" : "Audio Muted");

      const button = document.getElementById("ongoingMic");
      if (button) {
        button.classList.toggle("btn-success");
        button.classList.toggle("btn-error");
      }
    }
  }
}

function toggleVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      console.log(videoTrack.enabled ? "Video Enabled" : "Video Disabled");
      if (screenShare) screenShare = false;
      if (camShare) camShare = false;
      updateCallButtons();
    }
  }
}

async function switchToScreenShare() {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });
  await replaceVideoTrack(screenStream.getVideoTracks()[0]);
  screenStream.getVideoTracks()[0].onended = () => {
    switchToCamera();
  };
  screenShare = true;
  camShare = false;
  updateCallButtons();
}

async function switchToCamera() {
  const cameraStream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });
  await replaceVideoTrack(cameraStream.getVideoTracks()[0]);
  screenShare = false;
  camShare = true;
  updateCallButtons();
}

function updateCallButtons() {
  const camButton = document.getElementById("ongoingCam");
  const screenButton = document.getElementById("ongoingScreen");
  if (screenShare) {
    screenButton.classList.add("btn-success");
    screenButton.classList.remove("btn-error");
    camButton.classList.add("btn-error");
    camButton.classList.remove("btn-success");
  } else if (camShare) {
    camButton.classList.add("btn-success");
    camButton.classList.remove("btn-error");
    screenButton.classList.add("btn-error");
    screenButton.classList.remove("btn-success");
  } else {
    camButton.classList.remove("btn-success");
    screenButton.classList.remove("btn-success");
    camButton.classList.add("btn-error");
    screenButton.classList.add("btn-error");
  }
}

async function replaceVideoTrack(newVideoTrack) {
  const oldVideoTrack = localStream.getVideoTracks()[0];
  if (oldVideoTrack) {
    localStream.removeTrack(oldVideoTrack);
    oldVideoTrack.stop();
  }
  localStream.addTrack(newVideoTrack);
  showLocalStream(localStream);
  const senders = getAllVideoSenders();
  await Promise.all(
    senders.map((sender) => sender.replaceTrack(newVideoTrack)),
  );
}

function getAllVideoSenders() {
  const senders = [];
  for (const call of Object.values(activeCalls)) {
    const pc = call.peerConnection;
    if (!pc) continue;
    const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (videoSender) senders.push(videoSender);
  }
  return senders;
}

function videoLightbox(element) {
  const videoClone = element.cloneNode(true);
  videoClone.srcObject = element.srcObject;
  videoClone.className =
    "w-full h-full max-w-[90vw] max-h-[90vh] object-contain";
  const lightboxModal = document.getElementById("lightboxModal");
  const lightboxModalContent = lightboxModal.querySelector("div");
  if (lightboxModalContent.querySelector("video")) {
    lightboxModalContent.querySelectorAll("video").forEach((el) => {
      el.remove();
    });
  }
  lightboxModalContent.appendChild(videoClone);
  lightboxModal.showModal();
  lightboxModal.onclose = () => {
    lightboxModalContent.querySelectorAll("video").forEach((el) => {
      el.remove();
    });
  };
}
