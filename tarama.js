
const camera = document.getElementById("camera");
const canvas = document.getElementById("canvas");

const startCameraButton = document.getElementById("startCamera");
const takePhotoButton = document.getElementById("takePhoto");
const retakePhotoButton = document.getElementById("retakePhoto");
const readTextButton = document.getElementById("readText");

const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const cameraStatus = document.getElementById("cameraStatus");

const recognizedText = document.getElementById("recognizedText");
const ocrProgress = document.getElementById("ocrProgress");

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
        readTextButton.disabled = true;

        retakePhotoButton.hidden = true;

        recognizedText.textContent = "Henüz bir fotoğraf okunmadı.";
        ocrProgress.textContent = "";

        cameraStatus.textContent = "Kamera hazır. Fotoğraf çekebilirsin.";

    } catch (error) {

        cameraStatus.textContent =
            "Kamera açılamadı. Kamera iznini kontrol et.";

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
    readTextButton.disabled = false;

    retakePhotoButton.hidden = false;

    cameraStatus.textContent =
        "Fotoğraf çekildi! Şimdi fotoğrafı okuyabilirsin.";

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


// Fotoğraftaki yazıları okur.
async function recognizeText() {

    if (!canvas.width || !canvas.height) {
        return;
    }

    if (typeof Tesseract === "undefined") {

        ocrProgress.textContent = "OCR kütüphanesi yüklenemedi.";

        return;

    }

    readTextButton.disabled = true;

    recognizedText.textContent = "Fotoğraf okunuyor...";
    ocrProgress.textContent = "OCR hazırlanıyor...";

    try {

        const result = await Tesseract.recognize(
            canvas,
            "tur",
            {
                logger: function(message) {

                    if (message.status === "recognizing text") {

                        const percentage = Math.round(
                            message.progress * 100
                        );

                        ocrProgress.textContent =
                            "Metin okunuyor: %" + percentage;

                    }

                }
            }
        );

        const text = result.data.text.trim();

        if (text.length > 0) {

            recognizedText.textContent = text;

            ocrProgress.textContent = "Okuma tamamlandı.";

        } else {

            recognizedText.textContent =
                "Fotoğraftan metin okunamadı. Daha net bir fotoğraf çekmeyi dene.";

            ocrProgress.textContent = "Okuma başarısız.";

        }

    } catch (error) {

        console.error("OCR hatası:", error);

        recognizedText.textContent =
            "Fotoğraf okunurken bir hata oluştu.";

        ocrProgress.textContent = "Tekrar deneyebilirsin.";

    }

    readTextButton.disabled = false;

}


// Butonlara görevlerini verir.
startCameraButton.addEventListener("click", startCamera);

takePhotoButton.addEventListener("click", takePhoto);

retakePhotoButton.addEventListener("click", retakePhoto);

readTextButton.addEventListener("click", recognizeText);


// Sayfadan çıkarken kamerayı kapatır.
window.addEventListener("beforeunload", stopCamera);
