
const camera = document.getElementById("camera");
const canvas = document.getElementById("canvas");

const startCameraButton = document.getElementById("startCamera");
const takePhotoButton = document.getElementById("takePhoto");
const retakePhotoButton = document.getElementById("retakePhoto");

const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const cameraStatus = document.getElementById("cameraStatus");

let cameraStream = null;


// Kamerayı başlatır.
async function startCamera() {

    try {

        cameraStatus.textContent = "Kamera açılıyor...";

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment"
            },
            audio: false
        });

        camera.srcObject = cameraStream;

        await camera.play();

        camera.style.display = "block";
        canvas.style.display = "none";

        cameraPlaceholder.style.display = "none";

        takePhotoButton.disabled = false;

        retakePhotoButton.hidden = true;

        cameraStatus.textContent = "Kamera hazır. Fotoğraf çekebilirsin.";

    } catch (error) {

        cameraStatus.textContent =
            "Kamera açılamadı. Kamera iznini ve bağlantını kontrol et.";

        console.error("Kamera hatası:", error);

    }

}


// Fotoğraf çeker.
function takePhoto() {

    if (!cameraStream) {
        return;
    }

    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;

    const context = canvas.getContext("2d");

    context.drawImage(
        camera,
        0,
        0,
        canvas.width,
        canvas.height
    );

    camera.style.display = "none";
    canvas.style.display = "block";

    stopCamera();

    takePhotoButton.disabled = true;

    retakePhotoButton.hidden = false;

    cameraStatus.textContent = "Fotoğraf çekildi! Görüntüyü kontrol edebilirsin.";

}


// Kamerayı kapatır.
function stopCamera() {

    if (cameraStream) {

        cameraStream.getTracks().forEach(function(track) {
            track.stop();
        });

        cameraStream = null;

    }

}


// Yeniden fotoğraf çekmek için kamerayı açar.
function retakePhoto() {

    startCamera();

}


// Butonlara görevlerini verir.
startCameraButton.addEventListener("click", startCamera);

takePhotoButton.addEventListener("click", takePhoto);

retakePhotoButton.addEventListener("click", retakePhoto);


// Sayfadan çıkarken kamerayı kapatır.
window.addEventListener("beforeunload", stopCamera);
