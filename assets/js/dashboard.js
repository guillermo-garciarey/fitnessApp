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
	const avatarUrl = profile?.avatar_url || "alt_images/default-avatar.jpg";

	// Set avatar image
	const avatarImg = document.getElementById("avatar-preview");
	if (avatarImg) {
		avatarImg.src = avatarUrl;
	}

	// Set name in both logo and titleBar
	const logoLink = document.querySelector("#logo a");
	const titleName = document.querySelector("#titleBar .title");
	if (logoLink) logoLink.textContent = name + " " + surname;
	if (titleName) titleName.textContent = name + " " + surname;
})();

// After loading user profile
if (!profile.avatar_url || profile.avatar_url.includes("avatar.jpg")) {
	showLetterAvatar(profile.name, profile.surname);
}

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
