
const camera = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const cropImage = document.getElementById("cropImage");

const startCameraButton = document.getElementById("startCamera");
const takePhotoButton = document.getElementById("takePhoto");
const retakePhotoButton = document.getElementById("retakePhoto");
const readTextButton = document.getElementById("readText");

const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const cameraStatus = document.getElementById("cameraStatus");

const recognizedText = document.getElementById("recognizedText");
const ocrProgress = document.getElementById("ocrProgress");
const cropInfo = document.getElementById("cropInfo");

let cameraStream = null;
let cropper = null;


// Kamerayı başlatır.
async function startCamera() {

    try {

        stopCamera();

        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        cropImage.style.display = "none";
        camera.style.display = "none";

        cropInfo.hidden = true;

        cameraStatus.textContent = "Kamera açılıyor...";

        cameraStream = await navigator.mediaDevices.getUserMedia({

            video: {
                facingMode: "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },

            audio: false

        });

        camera.srcObject = cameraStream;

        await camera.play();

        camera.style.display = "block";

        cameraPlaceholder.style.display = "none";

        takePhotoButton.disabled = false;
        readTextButton.disabled = true;

        retakePhotoButton.hidden = true;

        recognizedText.textContent = "Henüz bir fotoğraf okunmadı.";
        ocrProgress.textContent = "";

        cameraStatus.textContent =
            "Kamera hazır. Fotoğraf çekebilirsin.";

    } catch (error) {

        cameraStatus.textContent =
            "Kamera açılamadı. Kamera iznini kontrol et.";

        console.error("Kamera hatası:", error);

    }

}


// Fotoğraf çeker ve kırpma aracını açar.
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

    stopCamera();

    camera.style.display = "none";

    cropImage.onload = function() {

        cropImage.style.display = "block";

        if (cropper) {
            cropper.destroy();
        }

        cropper = new Cropper(cropImage, {

            viewMode: 1,
            dragMode: "crop",
            autoCropArea: 0.8,
            responsive: true,
            background: false,
            movable: true,
            zoomable: true,
            scalable: false,
            rotatable: false,
            guides: true,
            center: true,
            highlight: true,
            cropBoxMovable: true,
            cropBoxResizable: true

        });

        readTextButton.disabled = false;

        cameraStatus.textContent =
            "İçindekiler bölümünü seç ve Seçili Alanı Oku butonuna bas.";

        cropInfo.hidden = false;

    };

    cropImage.src = canvas.toDataURL("image/jpeg", 0.95);

    takePhotoButton.disabled = true;
    retakePhotoButton.hidden = false;

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


// Görüntüyü OCR için iyileştirir.
function improveImage(sourceCanvas) {

    const processedCanvas = document.createElement("canvas");

    const scale = 2;

    processedCanvas.width = sourceCanvas.width * scale;
    processedCanvas.height = sourceCanvas.height * scale;

    const context = processedCanvas.getContext("2d", {
        willReadFrequently: true
    });

    context.drawImage(
        sourceCanvas,
        0,
        0,
        processedCanvas.width,
        processedCanvas.height
    );

    const imageData = context.getImageData(
        0,
        0,
        processedCanvas.width,
        processedCanvas.height
    );

    const pixels = imageData.data;

    const histogram = new Array(256).fill(0);

    // Gri tonlama.
    for (let i = 0; i < pixels.length; i += 4) {

        const gray = Math.round(
            0.299 * pixels[i] +
            0.587 * pixels[i + 1] +
            0.114 * pixels[i + 2]
        );

        pixels[i] = gray;
        pixels[i + 1] = gray;
        pixels[i + 2] = gray;

        histogram[gray]++;

    }

    // Otsu eşik değeri.
    const totalPixels = processedCanvas.width * processedCanvas.height;

    let sum = 0;

    for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
    }

    let sumBackground = 0;
    let weightBackground = 0;
    let maxVariance = 0;
    let threshold = 140;

    for (let i = 0; i < 256; i++) {

        weightBackground += histogram[i];

        if (weightBackground === 0) {
            continue;
        }

        const weightForeground = totalPixels - weightBackground;

        if (weightForeground === 0) {
            break;
        }

        sumBackground += i * histogram[i];

        const meanBackground = sumBackground / weightBackground;

        const meanForeground =
            (sum - sumBackground) / weightForeground;

        const variance =
            weightBackground *
            weightForeground *
            Math.pow(meanBackground - meanForeground, 2);

        if (variance > maxVariance) {

            maxVariance = variance;
            threshold = i;

        }

    }

    // Siyah-beyaz görüntü.
    for (let i = 0; i < pixels.length; i += 4) {

        const value = pixels[i] > threshold ? 255 : 0;

        pixels[i] = value;
        pixels[i + 1] = value;
        pixels[i + 2] = value;

    }

    context.putImageData(imageData, 0, 0);

    return processedCanvas;

}


// Kırpılmış fotoğrafı okur.
async function recognizeText() {

    if (!cropper) {

        cameraStatus.textContent =
            "Önce fotoğraf çekmelisin.";

        return;

    }

    if (typeof Tesseract === "undefined") {

        ocrProgress.textContent =
            "OCR kütüphanesi yüklenemedi.";

        return;

    }

    readTextButton.disabled = true;

    recognizedText.textContent = "Görüntü hazırlanıyor...";
    ocrProgress.textContent = "Seçilen alan işleniyor...";

    let worker = null;

    try {

        // Yalnızca seçilen alanı alır.
        const croppedCanvas = cropper.getCroppedCanvas({

            maxWidth: 2000,
            maxHeight: 2000,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: "high"

        });

        if (!croppedCanvas) {
            throw new Error("Fotoğraf kırpılamadı.");
        }

        // Kırpılan alanı iyileştirir.
        const processedImage = improveImage(croppedCanvas);

        ocrProgress.textContent =
            "Türkçe OCR motoru hazırlanıyor...";

        worker = await Tesseract.createWorker(
            "tur",
            1,
            {
                logger: function(message) {

                    if (message.status === "loading language traineddata") {

                        ocrProgress.textContent =
                            "Türkçe dil dosyası yükleniyor...";

                    }

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

        await worker.setParameters({

            tessedit_pageseg_mode: "6",
            preserve_interword_spaces: "1"

        });

        const result = await worker.recognize(processedImage);

        const text = result.data.text.trim();

        if (text.length > 0) {

            recognizedText.textContent = text;

            ocrProgress.textContent =
                "Okuma tamamlandı. Metni kontrol etmeyi unutma.";

        } else {

            recognizedText.textContent =
                "Seçilen alandan metin okunamadı. Daha net bir fotoğraf deneyebilirsin.";

            ocrProgress.textContent = "Okuma başarısız.";

        }

    } catch (error) {

        console.error("OCR hatası:", error);

        recognizedText.textContent =
            "Fotoğraf okunurken bir hata oluştu.";

        ocrProgress.textContent =
            "Bir hata oluştu. Tekrar deneyebilirsin.";

    } finally {

        if (worker) {
            await worker.terminate();
        }

        readTextButton.disabled = false;

    }

}


// Butonlara görevlerini verir.
startCameraButton.addEventListener("click", startCamera);

takePhotoButton.addEventListener("click", takePhoto);

retakePhotoButton.addEventListener("click", retakePhoto);

readTextButton.addEventListener("click", recognizeText);


// Sayfadan çıkarken kamerayı kapatır.
window.addEventListener("beforeunload", stopCamera);
