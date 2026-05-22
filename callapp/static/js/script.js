let chatSocket = null;
let peer = null;
let localStream = null;
let screenShare = false;
let camShare = false;
const activeCalls = {}; // Format: { peerId: callObject }
const userPeerMap = {}; // Format: { userId: peerId }
const messageTemplate = document.getElementById("messageTemplate");

function connectWebsocket() {
  chatSocket = new WebSocket("ws://" + window.location.host + "/");
  chatSocket.onopen = () => {
    const currentPath = window.location.pathname.trim().slice(1, -1);
    const currentPathArray = currentPath.split("/");
    if (currentPathArray.length === 3 && currentPathArray[0] === "channel") {
      joinTextChannel(currentPathArray[2]);
    }
  };
  chatSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "new_message") {
      createMessage(data);
    } else {
      handleSignal(data);
    }
  };
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
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
  } catch (error) {
    console.warn(
      "Kamera ve mikrofon bulunamadı, sadece mikrofon deneniyor:",
      error.name,
    );
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
    } catch (audioError) {
      console.warn(
        "Mikrofon bulunamadı, boş yayın oluşturuluyor.",
        audioError.name,
      );
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      canvas.getContext("2d").fillRect(0, 0, canvas.width, canvas.height);
      const videoStream = canvas.captureStream(30);
      try {
        const audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
        const oscillator = audioContext.createOscillator();
        const dst = audioContext.createMediaStreamDestination();
        oscillator.connect(dst);
        videoStream.addTrack(dst.stream.getAudioTracks()[0]);
      } catch (e) {
        console.error("AudioContext başlatılamadı", e);
      }
      return videoStream;
    }
  }
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
    console.log("My Peer ID:", id);
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
