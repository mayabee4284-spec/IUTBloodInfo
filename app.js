
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc,
  query, 
  where,
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDOENSjDoRlXCeO3xYfN7h1LnIxxrWHHHY",
  authDomain: "iutbloodinfo.firebaseapp.com",
  projectId: "iutbloodinfo",
  storageBucket: "iutbloodinfo.firebasestorage.app",
  messagingSenderId: "219192835330",
  appId: "1:219192835330:web:bf2eaba4a19e064541161b",
  measurementId: "G-K9RVCN91WT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const ALLOWED_DOMAIN = "@iut-dhaka.edu";

// DOM Elements
const authSection = document.getElementById("authSection");
const userInfo = document.getElementById("userInfo");
const userEmailSpan = document.getElementById("userEmail");
const appContent = document.getElementById("appContent");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const profileForm = document.getElementById("profileForm");
const bloodGroupInput = document.getElementById("bloodGroup");
const phoneInput = document.getElementById("phone");
const lastDonatedInput = document.getElementById("lastDonated");
const isAvailableInput = document.getElementById("isAvailable");

const filterBloodGroup = document.getElementById("filterBloodGroup");
const filterEligibility = document.getElementById("filterEligibility");
const donorsList = document.getElementById("donorsList");

const urgentFeed = document.getElementById("urgentFeed");
const openUrgentModalBtn = document.getElementById("openUrgentModalBtn");
const urgentFormCard = document.getElementById("urgentFormCard");
const urgentForm = document.getElementById("urgentForm");
const cancelUrgentBtn = document.getElementById("cancelUrgentBtn");

let cachedDonors = [];

// --- 1. Auth Handlers ---

loginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    if (!result.user.email.endsWith(ALLOWED_DOMAIN)) {
      alert(`Please sign in with your university email ending in ${ALLOWED_DOMAIN}`);
      await signOut(auth);
    }
  } catch (error) {
    console.error("Login Error:", error);
    alert("Login failed: " + error.message);
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user && user.email.endsWith(ALLOWED_DOMAIN)) {
    authSection.classList.add("hidden");
    userInfo.classList.remove("hidden");
    appContent.classList.remove("hidden");
    userEmailSpan.textContent = user.email;

    await loadUserProfile(user.uid);
    await loadDonors();
    await loadUrgentFeed();
  } else {
    authSection.classList.remove("hidden");
    userInfo.classList.add("hidden");
    appContent.classList.add("hidden");
  }
});

// --- 2. Profile Management ---

async function loadUserProfile(uid) {
  try {
    const userDoc = await getDoc(doc(db, "donors", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      bloodGroupInput.value = data.bloodGroup || "A+";
      phoneInput.value = data.phone || "";
      lastDonatedInput.value = data.lastDonated || "";
      isAvailableInput.checked = data.isAvailable !== false;
    }
  } catch (error) {
    console.error("Error loading profile:", error);
  }
}

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  try {
    await setDoc(doc(db, "donors", user.uid), {
      name: user.displayName || "Campus Student",
      email: user.email,
      bloodGroup: bloodGroupInput.value,
      phone: phoneInput.value,
      lastDonated: lastDonatedInput.value,
      isAvailable: isAvailableInput.checked,
      updatedAt: new Date()
    }, { merge: true });

    alert("Profile saved successfully!");
    await loadDonors();
  } catch (error) {
    console.error("Error saving profile:", error);
    alert("Failed to save profile.");
  }
});

// --- 3. Eligibility Calculation ---

function getEligibilityStatus(lastDonatedString) {
  if (!lastDonatedString) {
    return { eligible: true, label: "Eligible (No date logged)" };
  }

  const lastDonated = new Date(lastDonatedString);
  const today = new Date();
  const diffTime = today - lastDonated;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays >= 90) {
    return { eligible: true, label: "Eligible to donate" };
  } else {
    const daysLeft = 90 - diffDays;
    return { eligible: false, label: `Ineligible (${daysLeft}d remaining)` };
  }
}

// --- 4. Filterable Donor Directory ---

async function loadDonors() {
  donorsList.innerHTML = `<p style="color: var(--text-muted); font-size: 14px;">Loading donors list...</p>`;

  try {
    const q = query(collection(db, "donors"), where("isAvailable", "==", true));
    const querySnapshot = await getDocs(q);
    
    cachedDonors = [];
    querySnapshot.forEach(docSnap => cachedDonors.push(docSnap.data()));

    renderDonors();
  } catch (error) {
    console.error("Error fetching donors:", error);
    donorsList.innerHTML = `<p style="color: #ef5350; font-size: 14px;">Failed to load donors.</p>`;
  }
}

function renderDonors() {
  const selectedBg = filterBloodGroup.value;
  const selectedEligibility = filterEligibility.value;

  donorsList.innerHTML = "";
  let count = 0;

  cachedDonors.forEach((donor) => {
    if (selectedBg !== "ALL" && donor.bloodGroup !== selectedBg) return;

    const status = getEligibilityStatus(donor.lastDonated);
    if (selectedEligibility === "ELIGIBLE" && !status.eligible) return;

    count++;
    const statusClass = status.eligible ? "status-eligible" : "status-ineligible";

    const card = document.createElement("div");
    card.className = "donor-card";
    card.innerHTML = `
      <div class="donor-header">
        <span class="donor-name">${donor.name}</span>
        <span class="blood-badge">${donor.bloodGroup}</span>
      </div>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
        <strong>Phone:</strong> <a href="tel:${donor.phone}" style="color: var(--primary); text-decoration: none; font-weight: 600;">${donor.phone}</a>
      </p>
      <div>
        <span class="status-badge ${statusClass}">${status.label}</span>
      </div>
    `;
    donorsList.appendChild(card);
  });

  if (count === 0) {
    donorsList.innerHTML = `<p style="color: var(--text-muted); font-size: 14px; grid-column: 1/-1;">No matching available donors found.</p>`;
  }
}

filterBloodGroup.addEventListener("change", renderDonors);
filterEligibility.addEventListener("change", renderDonors);

// --- 5. Urgent Emergency Requests (Auto-Expiry 48h) ---

openUrgentModalBtn.addEventListener("click", () => urgentFormCard.classList.remove("hidden"));
cancelUrgentBtn.addEventListener("click", () => urgentFormCard.classList.add("hidden"));

urgentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, "urgent_requests"), {
      bloodGroup: document.getElementById("urgentBloodGroup").value,
      hospital: document.getElementById("urgentHospital").value,
      phone: document.getElementById("urgentPhone").value,
      postedByUid: user.uid,
      postedByEmail: user.email,
      createdAt: new Date().toISOString()
    });

    alert("Urgent request broadcasted!");
    urgentForm.reset();
    urgentFormCard.classList.add("hidden");
    await loadUrgentFeed();
  } catch (error) {
    console.error("Error posting urgent request:", error);
    alert("Could not post request.");
  }
});

async function loadUrgentFeed() {
  if (!urgentFeed) return;

  try {
    const q = query(collection(db, "urgent_requests"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    urgentFeed.innerHTML = "";
    const currentUser = auth.currentUser;
    const now = new Date();

    querySnapshot.forEach((docSnap) => {
      const req = docSnap.data();
      const reqId = docSnap.id;

      // Auto-Expiry Logic: Hide requests older than 48 hours
      const createdDate = new Date(req.createdAt);
      const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
      if (hoursDiff > 48) return;

      const isOwner = currentUser && req.postedByUid && req.postedByUid === currentUser.uid;

      const card = document.createElement("div");
      card.className = "urgent-banner";
      card.id = `urgent-card-${reqId}`;

      card.innerHTML = `
        <div class="flex-between" style="margin-bottom: 8px;">
          <div class="urgent-header"><span>🚨</span> URGENT BLOOD NEEDED</div>
          <div id="actions-${reqId}"></div>
        </div>
        <div>
          <p style="margin-bottom: 4px;"><strong>Blood Group:</strong> <span style="font-size: 16px; font-weight: 700;">${req.bloodGroup}</span></p>
          <p style="margin-bottom: 4px;"><strong>Location:</strong> ${req.hospital}</p>
          <p style="margin-bottom: 4px;"><strong>Contact:</strong> <a href="tel:${req.phone}" style="color: #991b1b; font-weight: 700;">${req.phone}</a></p>
          <p style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Posted by: ${req.postedByEmail || "Campus Student"}</p>
        </div>
      `;

      urgentFeed.appendChild(card);

      const actionsContainer = document.getElementById(`actions-${reqId}`);
      if (isOwner) {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn";
        deleteBtn.style.cssText = "background-color: #16a34a; font-size: 12px; padding: 6px 12px;";
        deleteBtn.textContent = "✓ Mark Fulfilled";
        deleteBtn.onclick = () => window.deleteUrgentRequest(reqId);
        actionsContainer.appendChild(deleteBtn);
      } else {
        const dismissBtn = document.createElement("button");
        dismissBtn.className = "btn btn-secondary";
        dismissBtn.style.cssText = "font-size: 12px; padding: 6px 12px;";
        dismissBtn.textContent = "Dismiss";
        dismissBtn.onclick = () => card.remove();
        actionsContainer.appendChild(dismissBtn);
      }
    });
  } catch (error) {
    console.error("Error loading emergency feed:", error);
  }
}

window.deleteUrgentRequest = async function(requestId) {
  if (!confirm("Has this request been fulfilled? Clicking OK will remove it for everyone.")) return;

  try {
    await deleteDoc(doc(db, "urgent_requests", requestId));
    const card = document.getElementById(`urgent-card-${requestId}`);
    if (card) card.remove();
  } catch (error) {
    console.error("Error deleting request:", error);
    alert("Failed to delete request.");
  }
};