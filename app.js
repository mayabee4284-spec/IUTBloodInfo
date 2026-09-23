

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const ALLOWED_DOMAIN = "@iut-dhaka.edu";

// DOM Elements
const authSection = document.getElementById("authSection");
const userInfo = document.getElementById("userInfo");
const userNameSpan = document.getElementById("userName");
const appContent = document.getElementById("appContent");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const profileForm = document.getElementById("profileForm");
const deptInput = document.getElementById("dept");
const batchInput = document.getElementById("batch");
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
let isLoggingIn = false;

// Helper: Aggressively strip digits/student IDs from names
function cleanStudentName(rawName, email) {
  let name = rawName || (email ? email.split("@")[0] : "");
  if (!name) return "IUT Student";

  // Remove all numeric sequences (e.g. 240041219)
  name = name.replace(/\d+/g, "").trim();
  
  // Remove leftover symbols like underscores, hyphens, or periods
  name = name.replace(/[._-]+/g, " ").trim();
  
  // Clean double spaces
  name = name.replace(/\s+/g, " ");
  
  // Capitalize each word properly
  return name.replace(/\b\w/g, char => char.toUpperCase()) || "IUT Student";
}

// --- 1. Authentication Flow ---

loginBtn.addEventListener("click", async () => {
  if (isLoggingIn) return;
  
  isLoggingIn = true;
  loginBtn.disabled = true;
  loginBtn.textContent = "Connecting to Google...";

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (!user.email || !user.email.endsWith(ALLOWED_DOMAIN)) {
      alert(`Access Restricted: Please sign in with an official university email ending in ${ALLOWED_DOMAIN}`);
      await signOut(auth);
    }
  } catch (error) {
    console.error("Auth Error:", error);
    
    // Provide user-friendly feedback based on standard Firebase error codes
    if (error.code === "auth/popup-closed-by-user") {
      // User closed popup; silent reset
    } else if (error.code === "auth/unauthorized-domain") {
      alert("Domain Authorization Error: Please ensure 'iut-blood-info.vercel.app' is added to Firebase Auth Authorized Domains.");
    } else if (error.code?.includes("requests-from-referer")) {
      alert("API Restriction Error: Your Google Cloud Key restricts requests from this URL.");
    } else {
      alert(`Login failed: ${error.message}`);
    }
  } finally {
    isLoggingIn = false;
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in with Google";
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Signout Error:", error);
  }
});

// Primary auth observer listener
onAuthStateChanged(auth, async (user) => {
  if (user && user.email && user.email.endsWith(ALLOWED_DOMAIN)) {
    authSection.classList.add("hidden");
    userInfo.classList.remove("hidden");
    appContent.classList.remove("hidden");
    
    const cleanName = cleanStudentName(user.displayName, user.email);
    userNameSpan.textContent = cleanName;

    // Load data concurrently
    await Promise.all([
      loadUserProfile(user.uid),
      loadDonors(),
      loadUrgentFeed()
    ]);
  } else {
    // Unauthenticated state
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
      deptInput.value = data.dept || "CSE";
      batchInput.value = data.batch || "";
      bloodGroupInput.value = data.bloodGroup || "A+";
      phoneInput.value = data.phone || "";
      lastDonatedInput.value = data.lastDonated || "";
      isAvailableInput.checked = data.isAvailable !== false;
    }
  } catch (error) {
    console.error("Error loading user profile:", error);
  }
}

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const displayNameClean = cleanStudentName(user.displayName, user.email);
  const submitBtn = profileForm.querySelector("button[type='submit']");
  
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    await setDoc(doc(db, "donors", user.uid), {
      name: displayNameClean,
      dept: deptInput.value.trim(),
      batch: batchInput.value.trim(),
      bloodGroup: bloodGroupInput.value,
      phone: phoneInput.value.trim(),
      lastDonated: lastDonatedInput.value,
      isAvailable: isAvailableInput.checked,
      updatedAt: new Date()
    }, { merge: true });

    alert("Profile saved successfully!");
    await loadDonors();
  } catch (error) {
    console.error("Error saving profile:", error);
    alert("Failed to save profile. Check connection.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Profile";
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

  if (isNaN(diffDays) || diffDays >= 90) {
    return { eligible: true, label: "Eligible to donate" };
  } else {
    const daysLeft = 90 - diffDays;
    return { eligible: false, label: `Ineligible (${daysLeft}d remaining)` };
  }
}

// --- 4. Donor Directory & Filters ---

async function loadDonors() {
  donorsList.innerHTML = `<p style="color: var(--text-muted); font-size: 14px; grid-column: 1/-1;">Loading donors directory...</p>`;

  try {
    const q = query(collection(db, "donors"), where("isAvailable", "==", true));
    const querySnapshot = await getDocs(q);
    
    cachedDonors = [];
    querySnapshot.forEach(docSnap => cachedDonors.push(docSnap.data()));

    renderDonors();
  } catch (error) {
    console.error("Error fetching donors:", error);
    donorsList.innerHTML = `<p style="color: #ef5350; font-size: 14px; grid-column: 1/-1;">Failed to load donor list.</p>`;
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
    
    // Format display attributes safely
    const cleanName = cleanStudentName(donor.name, "");
    const deptBatchText = donor.dept && donor.batch ? `${donor.dept} (${donor.batch})` : (donor.dept || donor.batch || "");
    const phoneDisplay = donor.phone 
      ? `<a href="tel:${donor.phone}" style="color: var(--primary); text-decoration: none; font-weight: 600;">${donor.phone}</a>`
      : `<span style="color: var(--text-muted); font-style: italic;">Not Provided</span>`;

    const card = document.createElement("div");
    card.className = "donor-card";
    card.innerHTML = `
      <div class="donor-header">
        <span class="donor-name">${cleanName}</span>
        <span class="blood-badge">${donor.bloodGroup || 'N/A'}</span>
      </div>
      ${deptBatchText ? `<div class="donor-sub">${deptBatchText}</div>` : ''}
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
        <strong>Phone:</strong> ${phoneDisplay}
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

// --- 5. Emergency Requests Feed ---

function getDismissedRequests() {
  return JSON.parse(localStorage.getItem("dismissed_urgent_requests") || "[]");
}

function dismissRequestLocally(requestId) {
  const dismissed = getDismissedRequests();
  if (!dismissed.includes(requestId)) {
    dismissed.push(requestId);
    localStorage.setItem("dismissed_urgent_requests", JSON.stringify(dismissed));
  }
}

openUrgentModalBtn.addEventListener("click", () => urgentFormCard.classList.remove("hidden"));
cancelUrgentBtn.addEventListener("click", () => urgentFormCard.classList.add("hidden"));

urgentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const cleanPosterName = cleanStudentName(user.displayName, user.email);
  const submitBtn = urgentForm.querySelector("button[type='submit']");
  
  submitBtn.disabled = true;

  try {
    await addDoc(collection(db, "urgent_requests"), {
      bloodGroup: document.getElementById("urgentBloodGroup").value,
      hospital: document.getElementById("urgentHospital").value.trim(),
      phone: document.getElementById("urgentPhone").value.trim(),
      postedByUid: user.uid,
      postedByName: cleanPosterName,
      createdAt: new Date().toISOString()
    });

    alert("Urgent request broadcasted successfully!");
    urgentForm.reset();
    urgentFormCard.classList.add("hidden");
    await loadUrgentFeed();
  } catch (error) {
    console.error("Error posting urgent request:", error);
    alert("Could not post request. Check Firestore permissions.");
  } finally {
    submitBtn.disabled = false;
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
    const dismissedList = getDismissedRequests();

    querySnapshot.forEach((docSnap) => {
      const req = docSnap.data();
      const reqId = docSnap.id;

      if (dismissedList.includes(reqId)) return;

      const createdDate = new Date(req.createdAt);
      const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
      
      // Auto-expire requests older than 48 hours
      if (hoursDiff > 48) return;

      const isOwner = currentUser && req.postedByUid && req.postedByUid === currentUser.uid;
      const cleanPoster = cleanStudentName(req.postedByName, "");

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
          <p style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Posted by: ${cleanPoster}</p>
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
        dismissBtn.onclick = () => {
          dismissRequestLocally(reqId);
          card.remove();
        };
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