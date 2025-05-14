let deferredPrompt;
const installBtn = document.getElementById("install-btn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // Stop automatic prompt
  deferredPrompt = e;

  // Optional: You can add a class here to visually highlight it if you want
  console.log("Install prompt captured and ready.");
});

installBtn.addEventListener("click", async (e) => {
  e.preventDefault(); // Prevent anchor behavior
  if (!deferredPrompt) {
    alert("Install prompt not available yet.");
    return;
  }

  deferredPrompt.prompt();

  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") {
    console.log("User accepted the install prompt");
  } else {
    console.log("User dismissed the install prompt");
  }

  deferredPrompt = null;
});
