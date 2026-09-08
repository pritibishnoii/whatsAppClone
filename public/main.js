/** @format */

// =========================
// ELEMENTS
// =========================

const login = document.getElementById("login");

const joinButton = document.getElementById("join");

const messageContainer = document.getElementById("message-container");

const usernameInput = document.getElementById("username");

const userContainer = document.getElementById("users");

const chatName = document.getElementById("chat-name");

const chatStatus = document.getElementById("chat-status");

const typingElement = document.getElementById("typing");

const messageInput = document.getElementById("message-input");

const sendButton = document.getElementById("send-button");

// =========================
// STATE
// =========================

let connection;

let currentUser = null;

let selectedUser = null;

let typingTimer;

let users = [];

// =========================
// JOIN
// =========================

joinButton.addEventListener("click", () => {
  const username = usernameInput.value.trim();

  if (!username) {
    alert("Enter Username");
    return;
  }

  currentUser = {
    userId: crypto.randomUUID(),
    username,
  };

  login.style.display = "none";

  connect();
});

// Enter on login

usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    joinButton.click();
  }
});

// =========================
// CONNECT
// =========================

function connect() {
  connection = new WebSocket("ws://localhost:8080");

  // =========================
  // OPEN
  // =========================

  connection.onopen = () => {
    console.log("Connected");

    connection.send(
      JSON.stringify({
        type: "join",

        userId: currentUser.userId,

        username: currentUser.username,
      })
    );
    saveUsersToStorage()
  };

  // =========================
  // RECEIVE
  // =========================

  connection.onmessage = (event) => {
    const data = JSON.parse(event.data);

    console.log("Received:", data);

    // USERS LIST

    if (data.type === "users-list") {
      users = data.users.map((u)=>({
        ...u,
        lastSeen:u.status==="offline"? "just now":null
      }))
saveUsersToStorage()
      renderUsers();
    }

    // PRESENCE

    if (data.type === "presence") {
      updateUserStatus(data.userId, data.status,data.username);
    }

    // PRIVATE MESSAGE

    if (data.type === "private-message") {
      handleMessage(data);
    }

    // TYPING

    if (data.type === "typing") {
      handleTyping(data);
    }
  };

  // =========================
  // CLOSE
  // =========================

  connection.onclose = () => {
    console.log("Disconnected...");
  };

  // =========================
  // ERROR
  // =========================

  connection.onerror = (error) => {
    console.log("WebSocket Error:", error);
  };
}

// =========================
// RENDER USERS
// =========================

function renderUsers() {
  userContainer.innerHTML = "";

  users.forEach((user) => {
    // Don't show myself

    if (user.userId === currentUser.userId) {
      return;
    }

    const li = document.createElement("li");

    li.className = "user";

    li.innerHTML = `

      <span class="user-name">
        ${user.username}
      </span>

      <span
        class="user-status ${user.status === "online" ? "online" : "offline"}"
      >
        ${user.status === "online" ? "online" : `Last seen ${user.lastSeen || "offline"}`}
      </span>

    `;

    li.addEventListener("click", () => {
      selectUser(user);
    });

    userContainer.appendChild(li);
  });
}

// =========================
// SELECT USER
// =========================

function selectUser(user) {
  const currenttime = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  selectedUser = user;

  console.log("Selected User:", selectedUser);

  chatName.innerText = user.username;

  chatStatus.innerText =
    user.status === "online" ? "online" : `last seen ${currenttime}`;

  const welcomeScreen = document.getElementById("welcome-screen");

  if (welcomeScreen) {
    welcomeScreen.style.display = "none";
  }

  messageContainer.style.display = "flex";

  const inputArea = document.querySelector(".input-area");

  if (inputArea) {
    inputArea.style.display = "flex";
  }

  messageInput.disabled = false;

  sendButton.disabled = false;

  messageContainer.innerHTML = "";
  // LocalStorage se is user ke purane messages load karein
  loadMessages(user.userId);
}

// =========================
// SEND MESSAGE
// =========================

function sendMessage() {
  // IMPORTANT:
  // selectedUser, NOT selectUser

  if (!selectedUser) {
    console.log("Please select a user");

    return;
  }

  const message = messageInput.value.trim();

  if (!message) return;

  const time = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  connection.send(
    JSON.stringify({
      type: "private-message",

      // id spelling
      senderId: currentUser.userId,

      receiverId: selectedUser.userId,

      message,

      time,
    })
  );

  messageInput.value = "";

  sendTyping(false);
}

// SEND BUTTON

sendButton.addEventListener("click", sendMessage);

// ENTER SEND

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

// =========================
// TYPING
// =========================

messageInput.addEventListener("input", () => {
  sendTyping(true);

  clearTimeout(typingTimer);

  typingTimer = setTimeout(() => {
    sendTyping(false);
  }, 1000);
});

// =========================
// SEND TYPING
// =========================

function sendTyping(isTyping) {
  if (
    !selectedUser ||
    !connection ||
    connection.readyState !== WebSocket.OPEN
  ) {
    return;
  }

  connection.send(
    JSON.stringify({
      type: "typing",

      senderId: currentUser.userId,

      receiverId: selectedUser.userId,

      isTyping,
    })
  );
}

// =========================
// RECEIVE MESSAGE
// =========================

function handleMessage(data) {
  if (!selectedUser) {
    return;
  }

  /*
    Current chat:

    Priti <-> Rahul

    Message should belong to
    this conversation.
  */

  const isCurrentChat =
    (data.senderId === selectedUser.userId &&
      data.receiverId === currentUser.userId) ||
    (data.senderId === currentUser.userId &&
      data.receiverId === selectedUser.userId);

  if (!isCurrentChat) {
    return;
  }

  // Am I sender?

  const isMine = data.senderId === currentUser.userId;

  addMessage(data.message, data.time, isMine,data.status);
}

// =========================
// ADD MESSAGE
// =========================

function addMessage(text, time, isMine,status,save=true) {
  const li = document.createElement("li");

  li.className = `message ${isMine ? "sent" : "received"}`;

  li.innerHTML = `

    <span class="message-text">
      ${text}
    </span>

    <span class="message-time">
      ${time} 
      <span>${status === "online" ? "✓✓" : "✓"}</span> 
    </span>
  `;

  messageContainer.appendChild(li);

  // Auto scroll
  messageContainer.scrollTop = messageContainer.scrollHeight;
if(save && selectedUser){
    saveMessageToStorage(selectedUser.userId, text, time, isMine);
}
}

// =========================
// HANDLE TYPING
// =========================

function handleTyping(data) {
  if (!selectedUser || data.senderId !== selectedUser.userId) {
    return;
  }

  const typingtext= document.getElementById("typing-text");
  if (data.isTyping) {
    typingElement.style.display = "flex"; // Bubble dikhayein
    if(typingtext){
        typingtext.innerText=`${data.username} is typing`
    }
  } else {
    typingElement.style.display = "none"; // Bubble chhupayein
  }

}

// =========================
// UPDATE USER STATUS
// =========================

// =========================
// UPDATE USER STATUS (Fix)
// =========================

function updateUserStatus(userId, status, username) {
  const user = users.find((u) => u.userId === userId);
const currenttime = new Date().toLocaleTimeString([],{
    hour:"2-digit",
    minute:"2-digit"
})
  if (user) {
    // Agar user pehle se list mein hai, toh status update karo
    user.status = status;
    if(status==="offline"){
        user.lastSeen=currenttime;
    }
  } else {
    // Agar naya user hai aur woh khud aap nahi hain, toh list mein jod lo
    if (userId !== currentUser.userId) {
      users.push({
        userId,
        username: username || "New User",
        lastSeen: status==="offline"? currenttime:null,
      });
    }
  }

  saveUsersToStorage()
  // Dobara sidebar render karo
  renderUsers();


  // Agar yahi user abhi chat mein khula hai, toh uska header status bhi update karo
  if (selectedUser && selectedUser.userId === userId) {
    selectedUser.status = status;
    selectedUser.lastSeen=user? user.lastSeen:currenttime
    if(status==="online"){
        chatStatus.innerText = "online"
    }else{
        chatStatus.innerText = `Last seen at ${selectedUser.lastSeen || "recently"}`;
    }
  }
}


function getStorageKey(otherUserID){
    // current user or samne bale user ki id milake ek uniq id genrat 
    return `chat_${currentUser.userId}_${otherUserID}`
}
function saveMessageToStorage(otherUserId, text, time, isMine) {
  const key = getStorageKey(otherUserId);
  const savedMessages = JSON.parse(localStorage.getItem(key)) || [];

  savedMessages.push({ text, time, isMine });
  localStorage.setItem(key, JSON.stringify(savedMessages));
}

function loadMessages(otherUserId) {
  const key = getStorageKey(otherUserId);
  const savedMessages = JSON.parse(localStorage.getItem(key)) || [];

  // Saare saved messages ko screen par render karein
  savedMessages.forEach((msg) => {
    addMessage(msg.text, msg.time, msg.isMine, false); // false matlab dubara storage me save mat karo
  });
}






// LocalStorage mein users save karne ke liye
function saveUsersToStorage() {
    if (!currentUser) return;
    // Hum sirf doosre users ko save karenge (apne aapko nahi)
    const otherUsers = users.filter(u => u.userId !== currentUser.userId);
    localStorage.setItem(`users_${currentUser.userId}`, JSON.stringify(otherUsers));
}

// Page load hone par ya connect hone par saved users load karne ke liye
function loadUsersFromStorage() {
    if (!currentUser) return;
    const saved = localStorage.getItem(`users_${currentUser.userId}`);
    if (saved) {
        const parsedUsers = JSON.parse(saved);
        // Server se aane wali list aur local storage wali list ko merge karein
        parsedUsers.forEach(savedUser => {
            const exists = users.find(u => u.userId === savedUser.userId);
            if (!exists) {
                users.push(savedUser);
            }
        });
        renderUsers();
    }
}