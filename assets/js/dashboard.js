import { supabase } from "./supabaseClient.js";
import {
	getSession,
	getUserProfile,
	getUserBookings,
	getAvailableClasses,
	isClassBooked,
	groupClassesByDate,
	formatDate,
	showLetterAvatar,
} from "./utils.js";

// Check for user login & set up profile information (name & avatar)
(async () => {
	const session = await getSession();
	const userId = session?.user?.id;

	if (!session || !userId) {
		window.location.href = "index.html"; // redirect to login
		return;
	}

	const profile = await getUserProfile(userId);
	const name = profile?.name || "User";
	const surname = profile?.surname || "Surname";
	const avatarUrl = profile?.avatar_url;

	// Set avatar image
	const avatarImg = document.getElementById("avatar-preview");
	if (avatarImg) {
		if (!avatarUrl || avatarUrl.includes("avatar.jpg")) {
			showLetterAvatar(name, surname);
		} else {
			avatarImg.src = avatarUrl;
		}
	}

	// Set name in both logo and titleBar
	const logoLink = document.querySelector("#logo a");
	const titleName = document.querySelector("#titleBar .title");
	const welcomeName = document.getElementById("welcome");
	if (logoLink) logoLink.textContent = name + " " + surname;
	if (titleName) titleName.textContent = name + " " + surname;
	if (welcomeName) welcomeName.textContent = "Welcome, " + name + "";
})();

// Enable avatar picture upload
const trigger = document.getElementById("avatar-trigger");
const input = document.getElementById("avatar-upload");
const img = document.getElementById("avatar-preview");

trigger.addEventListener("click", () => input.click());

input.addEventListener("change", async () => {
	const file = input.files[0];
	if (!file) return;

	// Show a temporary preview BEFORE uploading
	const previewURL = URL.createObjectURL(file);
	img.src = previewURL;

	const session = await getSession();
	const userId = session?.user?.id;
	if (!userId) return;

	const ext = file.name.split(".").pop();
	const filePath = `${userId}.${ext}`;

	// Upload file to Supabase Storage
	const { error: uploadError } = await supabase.storage
		.from("avatars")
		.upload(filePath, file, { upsert: true });

	if (uploadError) {
		alert("Upload failed");
		console.error("Upload error:", uploadError);
		return;
	}

	// Get public URL from Supabase
	const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
	const publicUrl = data.publicUrl;

	// Update profile with avatar URL
	const { error: updateError } = await supabase
		.from("profiles")
		.update({ avatar_url: publicUrl }) // ← Correct column name
		.eq("id", userId)
		.single();

	if (updateError) {
		console.error("Profile update error:", updateError);
		alert("Profile update failed");
		return;
	}

	// Update the avatar preview image
	img.src = publicUrl;
	alert("Profile photo updated!");
});
