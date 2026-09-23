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
  query, 
  orderBy, 
  limit 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Firebase Configuration (Ensure your keys are correct)
const firebaseConfig = {
  apiKey: "AIzaSyDOENSjDoRlXCeO3xYfN7h1LnIxxrWHHHY",
  authDomain: "iutbloodinfo.firebaseapp.com",
  projectId: "iutbloodinfo",
  storageBucket: "iutbloodinfo.firebasestorage.app",
  messagingSenderId: "219192835330",
  appId: "1:219192835330:web:bf2eaba4a19e064541161b",
  measurementId: "G-K9RVCN91WT"
};

// Initialize Firebase & Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Allowed University Email Domain
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

const donorsList = document.getElementById("donorsList");

const urgentBanner = document.getElementById("urgentBanner");
const urgentDetails = document.getElementById("urgentDetails");
const openUrgentModalBtn = document.getElementById("openUrgentModalBtn");
const urgentFormCard = document.getElementById("urgentFormCard");
const urgentForm = document.getElementById("urgentForm");
const cancelUrgentBtn = document.getElementById("cancelUrgentBtn");

// --- 2. Auth Listeners & Functions ---

loginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Verify University Domain
    if (!user.email.endsWith(ALLOWED_DOMAIN)) {
      alert(`Please use your official university email ending in ${ALLOWED_DOMAIN}`);
      await signOut(auth);
      return;
    }
  } catch (error) {
    console.error("Login Error:", error);
    alert("Login failed: " + error.message);
  }
});

logoutBtn.addEventListener("click", () => {
  signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (user && user.email.endsWith(ALLOWED_DOMAIN)) {
    // Show Authenticated Interface
    authSection.classList.add("hidden");
    userInfo.classList.remove("hidden");
    appContent.classList.remove("hidden");
    userEmailSpan.textContent = user.email;

    // Load User Data & Donors
    await loadUserProfile(user.uid);
    await loadDonors();
    await loadUrgentBanner();
  } else {
    // Show Logged Out Interface
    authSection.classList.remove("hidden");
    userInfo.classList.add("hidden");
    appContent.classList.add("hidden");
  }
});

// --- 3. Profile Management ---

async function loadUserProfile(uid) {
  try {
    const userDoc = await getDoc(doc(db, "donors", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      bloodGroupInput.value = data.bloodGroup || "A+";
      phoneInput.value = data.phone || "";
      lastDonatedInput.value = data.lastDonated || "";
      isAvailableInput.checked = data.isAvailable !== false; // Default to true if undefined
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
      name: user.displayName || "Anonymous Donor",
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

// --- 4. Eligibility Calculator ---

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
    return { eligible: false, label: `Ineligible (${daysLeft} days wait remaining)` };
  }
}

// --- 5. Donors List Directory ---

async function loadDonors() {
  donorsList.innerHTML = `<p style="color: var(--text-muted); font-size: 14px;">Loading donors list...</p>`;

  try {
    const querySnapshot = await getDocs(collection(db, "donors"));
    donorsList.innerHTML = "";

    let activeCount = 0;

    querySnapshot.forEach((docSnap) => {
      const donor = docSnap.data();

      // Only show donors who marked themselves available
      if (donor.isAvailable === false) return;

      activeCount++;
      const status = getEligibilityStatus(donor.lastDonated);
      const statusClass = status.eligible ? "status-eligible" : "status-ineligible";

      const card = document.createElement("div");
      card.className = "donor-card";
      card.innerHTML = `
        <div class="donor-header">
          <span class="donor-name">${donor.name}</span>
          <span class="blood-badge">${donor.bloodGroup}</span>
        </div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px;">
          <strong>Phone:</strong> <a href="tel:${donor.phone}" style="color: var(--primary); text-decoration: none;">${donor.phone}</a>
        </p>
        <div>
          <span class="status-badge ${statusClass}">${status.label}</span>
        </div>
      `;
      donorsList.appendChild(card);
    });

    if (activeCount === 0) {
      donorsList.innerHTML = `<p style="color: var(--text-muted); font-size: 14px;">No active donors available right now.</p>`;
    }
  } catch (error) {
    console.error("Error fetching donors:", error);
    donorsList.innerHTML = `<p style="color: #ef5350; font-size: 14px;">Failed to load donors.</p>`;
  }
}

// --- 6. Urgent Request Module ---

openUrgentModalBtn.addEventListener("click", () => {
  urgentFormCard.classList.remove("hidden");
});

cancelUrgentBtn.addEventListener("click", () => {
  urgentFormCard.classList.add("hidden");
});

urgentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const bloodGroup = document.getElementById("urgentBloodGroup").value;
  const hospital = document.getElementById("urgentHospital").value;
  const phone = document.getElementById("urgentPhone").value;

  try {
    await addDoc(collection(db, "urgent_requests"), {
      bloodGroup,
      hospital,
      phone,
      createdAt: new Date()
    });

    alert("Urgent request broadcasted!");
    urgentForm.reset();
    urgentFormCard.classList.add("hidden");
    await loadUrgentBanner();
  } catch (error) {
    console.error("Error posting urgent request:", error);
    alert("Could not post request.");
  }
});

async function loadUrgentBanner() {
  try {
    const q = query(collection(db, "urgent_requests"), orderBy("createdAt", "desc"), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const req = querySnapshot.docs[0].data();
      urgentDetails.innerHTML = `
        <p style="margin-bottom: 4px;"><strong>Blood Group Needed:</strong> <span style="font-size: 16px; font-weight: bold;">${req.bloodGroup}</span></p>
        <p style="margin-bottom: 4px;"><strong>Location:</strong> ${req.hospital}</p>
        <p><strong>Contact Immediately:</strong> <a href="tel:${req.phone}" style="color: #991b1b; font-weight: bold;">${req.phone}</a></p>
      `;
      urgentBanner.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Error loading urgent request:", error);
  }
}