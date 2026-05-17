let peer = null;
let callSocket = null;
let activeCall = null;
let localStream = null;
let remoteUserId = null;

function connectCallSocket() {
  // Canlı ortamda ws:// yerine wss:// (SSL) kullanılması gerekebilir
  callSocket = new WebSocket("ws://" + window.location.host + "/ws/call/");

  callSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleSignal(data);
  };
}

// Kamera veya mikrofon yoksa uygulamanın çökmesini engelleyen güvenli stream fonksiyonu
async function getSafeLocalStream() {
  try {
    // Önce hem kamera hem mikrofon istemeyi dene
    return await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
  } catch (error) {
    console.warn(
      "Kamera ve mikrofon tam olarak açılamadı, alternatif deneniyor:",
      error.name,
    );

    try {
      // Sadece mikrofon dene (kamera yoksa)
      return await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
    } catch (audioError) {
      console.warn(
        "Mikrofon da bulunamadı, boş stream oluşturuluyor.",
        audioError.name,
      );

      // Donanım tamamen yoksa WebRTC'nin patlamaması için sanal (boş) bir stream oluşturuyoruz
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      // Siyah bir ekran üretir
      canvas.getContext("2d").fillRect(0, 0, canvas.width, canvas.height);
      const videoStream = canvas.captureStream(30);

      try {
        // Varsa bir ses bağlamı oluştur, yoksa sadece boş video kalsın
        const audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
        const oscillator = audioContext.createOscillator();
        const dst = audioContext.createMediaStreamDestination();
        oscillator.connect(dst); // Sessiz bir akış için gain ayarlanabilir, varsayılan kalsın
        videoStream.addTrack(dst.stream.getAudioTracks()[0]);
      } catch (e) {
        console.error("AudioContext başlatılamadı", e);
      }

      return videoStream;
    }
  }
}

function initPeer() {
  peer = new Peer();

  peer.on("open", (id) => {
    console.log("My Peer ID:", id);
    window._myPeerId = id;
  });

  // Gelen aramayı yanıtlama kısmı (Asenkron yapıldı)
  peer.on("call", async (incomingCall) => {
    // Güvenli şekilde medya akışını alıyoruz (Cihaz yoksa bile çökmez)
    localStream = await getSafeLocalStream();

    showLocalStream(localStream);
    incomingCall.answer(localStream);
    incomingCall.on("stream", showRemoteStream);
    activeCall = incomingCall;

    document.getElementById("incomingCallModal").close();
    document.getElementById("ongoingCallModal").showModal();
    document.getElementById("ongoingCallOpener").classList.toggle("hidden");
  });
}

function showIncomingCallUI(data) {
  const incomingCallUI = document.getElementById("incomingCallModal");
  console.log(data);
  incomingCallUI.querySelector("#callerUsername").textContent =
    data.from_username;

  incomingCallUI.querySelector("#incomingCallAccept").onclick = () =>
    acceptCall(data.from_user_id);
  incomingCallUI.showModal();
  incomingCallUI.querySelector("#ring").play();
  incomingCallUI.onclose = () => incomingCallUI.querySelector("#ring").pause();
  document.getElementById("endOngoingCall").onclick = () => {
    (endCall(),
      document.getElementById("ongoingCallOpener").classList.toggle("hidden"));
    document.getElementById("ongoingCallModal").close();
  };
}

// handleSignal fonksiyonu async hale getirildi
async function handleSignal(data) {
  switch (data.signal_type) {
    case "call.offer":
      remoteUserId = data.from_user_id;
      showIncomingCallUI(data);
      break;

    case "call.answer":
      // Arayan tarafta sinyal onaylandığında medya akışını güvenli alıyoruz
      localStream = await getSafeLocalStream();

      showLocalStream(localStream);
      activeCall = peer.call(data.peer_id, localStream);
      activeCall.on("stream", showRemoteStream);

      document.getElementById("ongoingCallModal").showModal();
      document.getElementById("ongoingCallOpener").classList.toggle("hidden");
      break;

    case "call.reject":
      alert("Call was rejected.");
      cleanup();
      break;

    case "call.end":
      document.getElementById("ongoingCallOpener").classList.toggle("hidden");
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
  console.log("Arama kabul edildi.");
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
  if (remoteUserId) {
    callSocket.send(
      JSON.stringify({
        type: "call.end",
        target_user_id: remoteUserId,
      }),
    );
  }
  cleanup();
  remoteUserId = null;
}

function showLocalStream(stream) {
  const localVideo = document.getElementById("localVideo");
  if (localVideo) localVideo.srcObject = stream;
}

function showRemoteStream(stream) {
  const remoteVideo = document.getElementById("remoteVideo");
  if (remoteVideo) remoteVideo.srcObject = stream;
}

function cleanup() {
  if (activeCall) {
    try {
      activeCall.close();
    } catch (e) {}
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
  }

  const incomingModal = document.getElementById("incomingCallModal");
  const ongoingModal = document.getElementById("ongoingCallModal");
  const ongoingOpener = document.getElementById("ongoingOpener");

  if (incomingModal) incomingModal.close();
  if (ongoingModal) ongoingModal.close();
  if (ongoingOpener) ongoingOpener.classList.add("hidden");

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

      const button = document.getElementById("ongoingCam");
      if (button) {
        button.classList.toggle("btn-success");
        button.classList.toggle("btn-error");
      }
    }
  }
}
