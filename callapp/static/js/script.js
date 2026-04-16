const messageTemplate = document.getElementById("messageTemplate");
let chatSocket = null;

function connectWebsocket() {
  if (chatSocket) chatSocket.close();
  const pathname = window.location.pathname;
  console.log(pathname, pathname.split("/"));
  if (pathname.split("/").length !== 5 || !pathname.startsWith("/channel")) {
    return;
  }
  let channelID = pathname.split("/")[3];
  chatSocket = new WebSocket(
    "ws://" + window.location.host + "/ws/chat/" + channelID + "/",
  );
  chatSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    createMessage(data);
  };
}
document.addEventListener("htmx:pushedIntoHistory", (event) => {
  connectWebsocket();
});
window.onpopstate = connectWebsocket;
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
