
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

        stopCamera();

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
        canvas.style.display = "none";

        cameraPlaceholder.style.display = "none";

        takePhotoButton.disabled = false;
        readTextButton.disabled = true;

        retakePhotoButton.hidden = true;

        recognizedText.textContent = "Henüz bir fotoğraf okunmadı.";
        ocrProgress.textContent = "";

        cameraStatus.textContent =
            "Kamera hazır. İçindekiler listesini netleştir ve fotoğraf çek.";

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


// Görüntüyü OCR için iyileştirir.
function improveImage(sourceCanvas) {

    const processedCanvas = document.createElement("canvas");

    const scale = 2;

    processedCanvas.width = sourceCanvas.width * scale;
    processedCanvas.height = sourceCanvas.height * scale;

    const context = processedCanvas.getContext("2d", {
        willReadFrequently: true
    });

    // Görüntüyü büyütür.
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

    // Görüntüyü gri tonlamaya çevirir.
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

    // Otsu yöntemiyle eşik değerini hesaplar.
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

    // Siyah-beyaz görüntü oluşturur.
    for (let i = 0; i < pixels.length; i += 4) {

        const value = pixels[i] > threshold ? 255 : 0;

        pixels[i] = value;
        pixels[i + 1] = value;
        pixels[i + 2] = value;

    }

    context.putImageData(imageData, 0, 0);

    return processedCanvas;

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

    recognizedText.textContent = "Görüntü hazırlanıyor...";
    ocrProgress.textContent = "Fotoğraf iyileştiriliyor...";

    let worker = null;

    try {

        // Fotoğrafı OCR için iyileştirir.
        const processedImage = improveImage(canvas);

        ocrProgress.textContent = "Türkçe OCR motoru hazırlanıyor...";

        // Türkçe OCR motorunu başlatır.
        worker = await Tesseract.createWorker(
            "tur",
            1,
            {
                logger: function(message) {

                    if (message.status === "loading language traineddata") {

                        ocrProgress.textContent =
                            "Türkçe dil dosyası indiriliyor...";

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

        // Metin blokları için sayfa düzeni ayarı.
        await worker.setParameters({
            tessedit_pageseg_mode: "6",
            preserve_interword_spaces: "1"
        });

        // İyileştirilmiş fotoğrafı okur.
        const result = await worker.recognize(processedImage);

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
