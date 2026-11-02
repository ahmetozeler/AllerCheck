
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


// Alerjenlerin aranacak ifadeleri.
const allergenKeywords = {

    "Süt ve süt ürünleri": [
        "sut",
        "sut tozu",
        "sut proteini",
        "sut proteini konsantresi",
        "kazein",
        "kazeinat",
        "peynir alti suyu",
        "whey",
        "laktoz",
        "krema",
        "tereyagi",
        "yogurt",
        "peynir",
        "sut kati maddesi"
    ],

    "Yumurta": [
        "yumurta",
        "yumurta aki",
        "yumurta sarisi",
        "albumin",
        "ovalbumin",
        "yumurta tozu"
    ],

    "Fındık": [
        "findik",
        "findik unu",
        "findik ezmesi",
        "findik yagi",
        "findik parcaciklari"
    ],

    "Yer fıstığı": [
        "yer fistigi",
        "yer fistigi unu",
        "yer fistigi yagi",
        "fistik ezmesi",
        "araxis"
    ],

    "Ceviz": [
        "ceviz",
        "ceviz ici",
        "ceviz unu",
        "ceviz yagi"
    ],

    "Badem": [
        "badem",
        "badem unu",
        "badem yagi",
        "badem ezmesi"
    ],

    "Antep fıstığı": [
        "antep fistigi",
        "antep fistigi unu",
        "antep fistigi ezmesi"
    ],

    "Kaju": [
        "kaju",
        "kaju unu",
        "kaju ezmesi"
    ],

    "Gluten / Buğday": [
        "gluten",
        "bugday",
        "bugday unu",
        "bugday nisastasi",
        "arpa",
        "cavdar",
        "malt",
        "bugday proteini",
        "seitan"
    ],

    "Soya": [
        "soya",
        "soya unu",
        "soya proteini",
        "soya lesitini",
        "soya yagi",
        "soya sosu"
    ],

    "Susam": [
        "susam",
        "susam yagi",
        "tahin",
        "susam unu"
    ],

    "Balık": [
        "balik",
        "balik unu",
        "balik yagi",
        "balik proteini",
        "hamsi",
        "somon",
        "ton baligi"
    ],

    "Kabuklu deniz ürünleri": [
        "karides",
        "yengec",
        "istakoz",
        "kerevit",
        "midye",
        "istiridye",
        "kalamar",
        "kabuklu deniz urunleri",
        "kabuklu deniz hayvanlari"
    ],

    "Hardal": [
        "hardal",
        "hardal unu",
        "hardal tohumu",
        "hardal yagi"
    ],

    "Kereviz": [
        "kereviz",
        "kereviz unu",
        "kereviz tohumu",
        "kereviz tozu"
    ],

    "Acı bakla": [
        "aci bakla",
        "lupin",
        "lupine",
        "lupin unu"
    ],

    "Sülfit": [
        "sulfit",
        "sulfid",
        "kukurtdioksit",
        "e220",
        "e221",
        "e222",
        "e223",
        "e224",
        "e225",
        "e226",
        "e227",
        "e228"
    ]

};


// Türkçe karakterleri ve metin biçimini düzenler.
function normalizeText(text) {

    return text
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


// Kelimenin metinde ayrı bir ifade olarak bulunup bulunmadığını kontrol eder.
function containsKeyword(text, keyword) {

    const normalizedKeyword = normalizeText(keyword);

    const escapedKeyword = normalizedKeyword.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

    const regex = new RegExp(
        "(^|\\s)" + escapedKeyword + "(?=\\s|$)"
    );

    return regex.test(text);

}


// Kullanıcının seçtiği alerjenleri kontrol eder.
function checkAllergens(productText) {

    const savedAllergens = localStorage.getItem("allergens");

    if (!savedAllergens) {
        return {
            selected: [],
            matches: [],
            crossContamination: false,
            missing: false
        };
    }

    let selectedAllergens = [];

    try {

        selectedAllergens = JSON.parse(savedAllergens);

        if (!Array.isArray(selectedAllergens)) {
            selectedAllergens = [];
        }

    } catch (error) {

        console.error("Alerjen kayıt hatası:", error);

        return {
            selected: [],
            matches: [],
            crossContamination: false,
            missing: true
        };

    }

    const normalizedProduct = normalizeText(productText);

    const matches = [];

    selectedAllergens.forEach(function(allergen) {

        const keywords = allergenKeywords[allergen];

        if (!keywords) {
            return;
        }

        const foundKeywords = keywords.filter(function(keyword) {

            return containsKeyword(normalizedProduct, keyword);

        });

        if (foundKeywords.length > 0) {

            matches.push({
                name: allergen,
                found: foundKeywords
            });

        }

    });

    // Çapraz bulaşma uyarılarını kontrol eder.
    const crossContaminationPhrases = [
        "eser miktarda icerebilir",
        "eser miktarda bulunabilir",
        "ayni hatta uretilmistir",
        "ayni tesiste uretilmistir",
        "iz miktarda icerebilir",
        "iz miktarda bulunabilir"
    ];

    const crossContamination =
        crossContaminationPhrases.some(function(phrase) {

            return normalizedProduct.includes(phrase);

        });

    return {
        selected: selectedAllergens,
        matches: matches,
        crossContamination: crossContamination,
        missing: false
    };

}


// Sonuç bölümünü ekrana yazdırır.
function showAllergenResults(productText, confidence) {

    let resultArea = document.getElementById("allergyResults");

    if (!resultArea) {

        resultArea = document.createElement("div");

        resultArea.id = "allergyResults";

        resultArea.style.marginTop = "20px";

        document.querySelector(".result-card").appendChild(resultArea);

    }

    resultArea.innerHTML = "";

    const result = checkAllergens(productText);

    const heading = document.createElement("h2");

    heading.textContent = "Alerjen Kontrol Sonucu";

    heading.style.marginBottom = "15px";

    resultArea.appendChild(heading);


    // Kullanıcı alerjen seçmemişse.
    if (result.missing || result.selected.length === 0) {

        const message = document.createElement("p");

        message.textContent = result.missing
            ? "Alerjen kayıtları okunamadı. Alerjenlerini tekrar seçmelisin."
            : "Henüz bir alerjen seçmemişsin. Önce alerjen seçimlerini yapmalısın.";

        resultArea.appendChild(message);

        return;

    }


    // OCR güvenilirliği düşükse.
    if (confidence < 55) {

        const warning = document.createElement("p");

        warning.textContent =
            "Fotoğraf yeterince net okunamadı. Sonuç güvenilir olmayabilir. Daha net bir fotoğraf çekmeni öneriyoruz.";

        warning.style.color = "#f0b84b";

        resultArea.appendChild(warning);

    }


    // Seçilen alerjenlerden bulunanlar.
    if (result.matches.length > 0) {

        const warning = document.createElement("div");

        warning.style.padding = "15px";
        warning.style.borderRadius = "10px";
        warning.style.background = "rgba(255, 70, 70, 0.10)";
        warning.style.border = "1px solid rgba(255, 70, 70, 0.4)";
        warning.style.color = "#ff7777";

        const title = document.createElement("h3");

        title.textContent = "DİKKAT! Eşleşen alerjenler bulundu.";

        warning.appendChild(title);

        const list = document.createElement("ul");

        list.style.paddingLeft = "20px";
        list.style.marginTop = "10px";

        result.matches.forEach(function(match) {

            const item = document.createElement("li");

            item.textContent =
                match.name + " (Tespit edilen ifade: " +
                match.found.join(", ") + ")";

            list.appendChild(item);

        });

        warning.appendChild(list);

        resultArea.appendChild(warning);

    } else {

        const success = document.createElement("div");

        success.style.padding = "15px";
        success.style.borderRadius = "10px";
        success.style.background = "rgba(37, 214, 154, 0.08)";
        success.style.border = "1px solid rgba(37, 214, 154, 0.3)";
        success.style.color = "#25d69a";

        const title = document.createElement("h3");

        title.textContent =
            "Seçtiğin alerjenlerle eşleşen bir ifade tespit edilmedi.";

        success.appendChild(title);

        resultArea.appendChild(success);

    }


    // Çapraz bulaşma uyarısı.
    if (result.crossContamination) {

        const crossWarning = document.createElement("p");

        crossWarning.textContent =
            "DİKKAT: Ürün etiketinde eser miktarda veya aynı üretim hattında bulunma uyarısı tespit edildi. Bu uyarı ayrıca değerlendirilmelidir.";

        crossWarning.style.color = "#f0b84b";
        crossWarning.style.marginTop = "15px";

        resultArea.appendChild(crossWarning);

    }


    // Her durumda gösterilecek güvenlik uyarısı.
    const disclaimer = document.createElement("p");

    disclaimer.textContent =
        "Önemli: Bu sonuç yalnızca fotoğraftan okunan metne dayanır. OCR hataları, eksik etiket bilgileri veya çapraz bulaşma nedeniyle ürünün güvenli olduğu garanti edilemez. Ciddi alerjin varsa ürün etiketini ve üretici bilgisini ayrıca kontrol et.";

    disclaimer.style.color = "var(--muted)";
    disclaimer.style.fontSize = "13px";
    disclaimer.style.lineHeight = "1.6";
    disclaimer.style.marginTop = "18px";

    resultArea.appendChild(disclaimer);

}


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

        const oldResults = document.getElementById("allergyResults");

        if (oldResults) {
            oldResults.remove();
        }

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

    for (let i = 0; i < pixels.length; i += 4) {

        const value = pixels[i] > threshold ? 255 : 0;

        pixels[i] = value;
        pixels[i + 1] = value;
        pixels[i + 2] = value;

    }

    context.putImageData(imageData, 0, 0);

    return processedCanvas;

}


// Kırpılmış fotoğrafı okur ve alerjenleri kontrol eder.
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

        const croppedCanvas = cropper.getCroppedCanvas({

            maxWidth: 2000,
            maxHeight: 2000,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: "high"

        });

        if (!croppedCanvas) {
            throw new Error("Fotoğraf kırpılamadı.");
        }

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
                "Okuma tamamlandı. Alerjenler kontrol ediliyor...";

            showAllergenResults(
                text,
                result.data.confidence || 0
            );

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
