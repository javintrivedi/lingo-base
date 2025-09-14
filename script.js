// ✅ Firebase v8 Style (CDN compatible)
// Make sure in your HTML you added before script.js:
// <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-analytics.js"></script>
// <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-auth.js"></script>
// <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>

const firebaseConfig = {
  apiKey: "AIzaSyB09iDbKG1q3Uouk2VOtcb1fpSn2kJP6Vc",
  authDomain: "lingo-f89e1.firebaseapp.com",
  projectId: "lingo-f89e1",
  storageBucket: "lingo-f89e1.firebasestorage.app",
  messagingSenderId: "1067102254707",
  appId: "1:1067102254707:web:92b518841d6db2e9421c06",
  measurementId: "G-MQVVD52Y37"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
firebase.analytics();

const auth = firebase.auth();
const db = firebase.database();

// UI References
const authContainer = document.getElementById("authContainer");
const chatContainer = document.getElementById("chatContainer");
const messagesDiv = document.getElementById("messages");

// ✅ Signup
function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  auth.createUserWithEmailAndPassword(email, password)
    .then(() => {
      alert("Signup successful! You can now login.");
    })
    .catch(err => alert(err.message));
}

// ✅ Login
function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  console.log("Attempting login for:", email);
  auth.signInWithEmailAndPassword(email, password)
    .then(() => console.log("Login successful"))
    .catch(err => {
      console.error("Login error:", err.message);
      alert(err.message);
    });
}

// Add event listeners for login and signup buttons
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");
  const messageInput = document.getElementById("messageInput");

  if (loginBtn) {
    loginBtn.addEventListener("click", login);
  }
  if (signupBtn) {
    signupBtn.addEventListener("click", signup);
  }
  if (messageInput) {
    messageInput.addEventListener("keypress", function(event) {
      if (event.key === "Enter") {
        sendMessage();
      }
    });
  }
});

// ✅ Logout
function logout() {
  auth.signOut();
}

// ✅ Track Auth State
auth.onAuthStateChanged(user => {
  console.log("Auth state changed:", user ? "logged in" : "logged out");
  if (user) {
    // Add user to DB
    db.ref(`users/${user.uid}`).set({
      email: user.email,
      name: user.email.split("@")[0],
      online: true,
      language: 'en' // default language
    });
    // Set online status
    db.ref(`users/${user.uid}/online`).onDisconnect().set(false);

    gsap.to(authContainer, {duration: 0.5, opacity: 0, pointerEvents: "none", onComplete: () => {
      authContainer.classList.add("hidden");
      chatContainer.classList.add("show");
      chatContainer.classList.remove("hidden");
      gsap.fromTo(chatContainer, {opacity: 0, y: 50}, {duration: 0.5, opacity: 1, y: 0});
      loadUsers();
      loadAllUsers();
      loadMessages();
    }});
  } else {
    if (auth.currentUser) {
      db.ref(`users/${auth.currentUser.uid}/online`).set(false);
    }
    gsap.to(chatContainer, {duration: 0.5, opacity: 0, y: 50, pointerEvents: "none", onComplete: () => {
      chatContainer.classList.remove("show");
      chatContainer.classList.add("hidden");
      authContainer.classList.remove("hidden");
      gsap.to(authContainer, {duration: 0.5, opacity: 1, pointerEvents: "auto"});
    }});
  }
});

// ✅ Send Message
function sendMessage() {
  const msg = document.getElementById("messageInput").value;
  const lang = document.getElementById("targetLang").value;
  const user = auth.currentUser;

  if (!msg.trim() || !user) return;

  // Send message as is, translation happens on receiving
  db.ref(`messages/${currentChat}`).push({
    uid: user.uid,
    text: msg,
    lang: lang,
    email: user.email,
    timestamp: Date.now()
  });

  document.getElementById("messageInput").value = "";
}

let currentChat = 'general';

// Load messages for selected chat with auto-translation for received messages
function loadMessages() {
  messagesDiv.innerHTML = ""; // clear old
  db.ref(`messages/${currentChat}`).on("child_added", snapshot => {
    const msg = snapshot.val();
    const user = auth.currentUser;

    const div = document.createElement("div");
    div.classList.add("message");

    // Differentiate between sent & received
    if (msg.uid === user.uid) {
      div.classList.add("sent");
      // For sent messages, show original
      div.innerHTML = `
        <p><strong>You</strong></p>
        <p>${msg.text}</p>
        <em>Sent in ${msg.lang}</em>
      `;
    } else {
      div.classList.add("received");
      // For received messages, auto-translate to user's language
      db.ref(`users/${user.uid}/language`).once('value', langSnapshot => {
        const userLang = langSnapshot.val() || 'en';
        if (msg.lang === userLang) {
          // Already in user's language
          div.innerHTML = `
            <p><strong>${msg.email.split("@")[0]}</strong></p>
            <p>${msg.text}</p>
          `;
        } else {
          // Translate to user's language using LibreTranslate
          fetch('https://libretranslate.com/translate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q: msg.text, source: msg.lang, target: userLang }),
          })
          .then(res => res.json())
          .then(data => {
            const autoTranslated = data.translatedText;
            div.innerHTML = `
              <p><strong>${msg.email.split("@")[0]}</strong></p>
              <p>${msg.text}</p>
              <em>${autoTranslated}</em>
            `;
          })
          .catch(() => {
            // Fallback to original
            div.innerHTML = `
              <p><strong>${msg.email.split("@")[0]}</strong></p>
              <p>${msg.text}</p>
            `;
          });
        }
      });
    }

    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// Load friends list
function loadUsers() {
  const userListDiv = document.getElementById("userList");
  userListDiv.innerHTML = "";
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  // Load friends
  db.ref(`friends/${currentUser.uid}`).once('value', friendsSnapshot => {
    const friends = friendsSnapshot.val() || {};
    const friendUids = Object.keys(friends);

    // Also include self
    friendUids.push(currentUser.uid);

    // Load user data for each friend
    friendUids.forEach(uid => {
      db.ref(`users/${uid}`).once('value', userSnapshot => {
        const user = userSnapshot.val();
        if (!user) return;
        const div = document.createElement("div");
        div.classList.add("user-item");
        div.setAttribute("data-uid", uid);
        div.onclick = () => selectChat(uid);
        if (uid === currentUser.uid) {
          div.classList.add("active");
        }
        div.innerHTML = `
          <div class="user-avatar" style="background: ${user.profilePic ? `url(${user.profilePic})` : 'linear-gradient(135deg, #ff9a9e, #fecfef)'}; background-size: cover; background-position: center;">
            ${user.profilePic ? '' : user.name.charAt(0).toUpperCase()}
          </div>
          <div class="user-info">
            <div class="user-name">${user.name}</div>
            <div class="user-status">${user.online ? "Online" : "Offline"}</div>
          </div>
        `;
        if (user.online) {
          const onlineDot = document.createElement("div");
          onlineDot.classList.add("online-indicator");
          div.querySelector(".user-avatar").appendChild(onlineDot);
        }
        userListDiv.appendChild(div);
      });
    });
  });
}

// Load all users for find friends
function loadAllUsers() {
  const allUsersDiv = document.getElementById("allUsersList");
  allUsersDiv.innerHTML = "";
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  // Get friends first
  db.ref(`friends/${currentUser.uid}`).once('value', friendsSnap => {
    const friends = friendsSnap.val() || {};
    const friendUids = Object.keys(friends);

    // Then get all users
    db.ref("users").once('value', snapshot => {
      const users = snapshot.val();
      if (!users) return;

      Object.entries(users).forEach(([uid, user]) => {
        if (!user || uid === currentUser.uid || friendUids.includes(uid)) return; // exclude self and friends

        const div = document.createElement("div");
        div.classList.add("user-item");
        div.innerHTML = `
          <div class="user-avatar" style="background: ${user.profilePic ? `url(${user.profilePic})` : 'linear-gradient(135deg, #ff9a9e, #fecfef)'}; background-size: cover; background-position: center;">
            ${user.profilePic ? '' : user.name.charAt(0).toUpperCase()}
          </div>
          <div class="user-info">
            <div class="user-name">${user.name}</div>
            <div class="user-status">${user.online ? "Online" : "Offline"}</div>
          </div>
          <button onclick="addFriend('${uid}')">Add</button>
        `;
        if (user.online) {
          const onlineDot = document.createElement("div");
          onlineDot.classList.add("online-indicator");
          div.querySelector(".user-avatar").appendChild(onlineDot);
        }
        allUsersDiv.appendChild(div);
      });
    });
  });
}

function addFriend(uid) {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  if (!uid) {
    // fallback to username input method
    const username = document.getElementById('friendUsername').value.trim();
    if (!username) return;

    // Search for user with name == username
    db.ref('users').orderByChild('name').equalTo(username).once('value', snapshot => {
      const users = snapshot.val();
      if (users) {
        const friendUid = Object.keys(users)[0]; // assuming unique names
        if (friendUid !== currentUser.uid) {
          // Check if already friend
          db.ref(`friends/${currentUser.uid}/${friendUid}`).once('value', friendSnap => {
            if (friendSnap.exists()) {
              alert('Already friends!');
            } else {
              // Add to friends
              db.ref(`friends/${currentUser.uid}/${friendUid}`).set(true);
              alert('Friend added!');
              document.getElementById('friendUsername').value = '';
              loadUsers(); // refresh list
              loadAllUsers(); // refresh all users list
            }
          });
        } else {
          alert('Cannot add yourself as friend.');
        }
      } else {
        alert('User not found.');
      }
    });
  } else {
    // Add friend by uid directly (from all users list)
    if (uid === currentUser.uid) {
      alert('Cannot add yourself as friend.');
      return;
    }
    db.ref(`friends/${currentUser.uid}/${uid}`).once('value', friendSnap => {
      if (friendSnap.exists()) {
        alert('Already friends!');
      } else {
        db.ref(`friends/${currentUser.uid}/${uid}`).set(true);
        alert('Friend added!');
        loadUsers();
        loadAllUsers();
      }
    });
  }
}

// Select chat from sidebar (private chat with user)
function selectChat(userId) {
  if (userId === auth.currentUser.uid) return; // Can't chat with self
  const currentUserId = auth.currentUser.uid;
  const chatId = [currentUserId, userId].sort().join('_'); // Sort to ensure consistent chatId
  if (chatId === currentChat) return;
  currentChat = chatId;
  // Update active user item UI
  document.querySelectorAll('.user-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-uid') === userId);
  });
  // Update chat header
  db.ref(`users/${userId}`).once('value', snapshot => {
    const user = snapshot.val();
    document.querySelector('.contact-name').textContent = user.name;
    document.querySelector('.contact-status').textContent = user.online ? 'Online' : 'Offline';
  });
  // Reload messages for new chat
  loadMessages();
}



// User Profile Modal
function openUserProfile() {
  const modal = document.getElementById("userProfileModal");
  modal.classList.remove("hidden");
  loadUserProfile();
}

function closeUserProfile() {
  const modal = document.getElementById("userProfileModal");
  modal.classList.add("hidden");
}

function loadUserProfile() {
  const user = auth.currentUser;
  if (!user) return;

  db.ref(`users/${user.uid}`).once('value', snapshot => {
    const userData = snapshot.val();
    if (userData) {
      document.getElementById("profileName").value = userData.name || "";
      document.getElementById("profileStatus").value = userData.status || "";
      if (userData.profilePic) {
        document.getElementById("profilePicPreview").style.backgroundImage = `url(${userData.profilePic})`;
      }
    }
  });
}

document.getElementById("profileForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const name = document.getElementById("profileName").value;
  const status = document.getElementById("profileStatus").value;
  const file = document.getElementById("profilePic").files[0];

  if (file) {
    // Convert to base64
    const reader = new FileReader();
    reader.onload = function(event) {
      const profilePic = event.target.result;
      saveProfile(user.uid, name, status, profilePic);
    };
    reader.readAsDataURL(file);
  } else {
    saveProfile(user.uid, name, status);
  }
});

// New code to preview selected profile picture immediately
document.getElementById("profilePic").addEventListener("change", function() {
  const file = this.files[0];
  const preview = document.getElementById("profilePicPreview");
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      preview.style.backgroundImage = `url(${event.target.result})`;
    };
    reader.readAsDataURL(file);
  } else {
    preview.style.backgroundImage = "";
  }
});

function saveProfile(uid, name, status, profilePic) {
  const update = {
    name: name,
    status: status,
    language: 'en' // default
  };
  if (profilePic) {
    update.profilePic = profilePic;
  }
  db.ref(`users/${uid}`).update(update).then(() => {
    // Update the user's avatar in the sidebar immediately
    if (profilePic) {
      const userAvatar = document.querySelector(`.user-item[data-uid="${uid}"] .user-avatar`);
      if (userAvatar) {
        userAvatar.style.backgroundImage = `url(${profilePic})`;
        userAvatar.style.backgroundSize = 'cover';
        userAvatar.style.backgroundPosition = 'center';
        userAvatar.innerHTML = ''; // remove the initial letter
      }
    }
    alert("Profile updated!");
    closeUserProfile();
    loadUsers(); // Refresh user list
  }).catch(err => alert("Error updating profile: " + err.message));
}
