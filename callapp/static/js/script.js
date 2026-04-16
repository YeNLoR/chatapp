const messageTemplate = document.getElementById("messageTemplate");
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

const chatSocket = new WebSocket(
  "ws://" + window.location.host + "/ws/chat/" + "1" + "/",
);

chatSocket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  createMessage(data);
};

document.addEventListener("click", (event) => {
  if (event.target.id === "messageSubmit") {
    const messageInput = document.getElementById("messageInput");
    const message = messageInput.value;
    chatSocket.send(JSON.stringify({ message: message }));
  }
});

document.addEventListener("htmx:afterRequest", (event) => {
  if (event.detail.elt.id === "messageForm") {
    event.detail.elt.querySelector("#messageInput").value = "";
    event.detail.elt.querySelector("#messageInput").focus();
  }
});
