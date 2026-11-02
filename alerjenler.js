
const allergens = [
    "Süt ve süt ürünleri",
    "Yumurta",
    "Fındık",
    "Yer fıstığı",
    "Ceviz",
    "Badem",
    "Antep fıstığı",
    "Kaju",
    "Gluten / Buğday",
    "Soya",
    "Susam",
    "Balık",
    "Kabuklu deniz ürünleri",
    "Hardal",
    "Kereviz",
    "Acı bakla",
    "Sülfit"
];

const allergenList = document.getElementById("allergenList");
const selectedCount = document.getElementById("selectedCount");
const saveButton = document.getElementById("saveButton");
const clearButton = document.getElementById("clearButton");
const statusMessage = document.getElementById("statusMessage");

let selectedAllergens = JSON.parse(
    localStorage.getItem("allergens")
) || [];


// Alerjenleri ekrana yazdırır.
function renderAllergens() {

    allergenList.innerHTML = "";

    allergens.forEach(function(allergen) {

        const isSelected = selectedAllergens.includes(allergen);

        const label = document.createElement("label");

        label.className = "allergen-item";

        if (isSelected) {
            label.classList.add("selected");
        }

        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.value = allergen;
        checkbox.checked = isSelected;

        const span = document.createElement("span");

        span.textContent = allergen;

        checkbox.addEventListener("change", function() {

            if (checkbox.checked) {
                selectedAllergens.push(allergen);
            } else {
                selectedAllergens = selectedAllergens.filter(
                    function(item) {
                        return item !== allergen;
                    }
                );
            }

            label.classList.toggle("selected", checkbox.checked);

            updateCount();

            statusMessage.textContent = "";
        });

        label.appendChild(checkbox);
        label.appendChild(span);

        allergenList.appendChild(label);

    });

    updateCount();
}


// Seçilen alerjen sayısını günceller.
function updateCount() {

    selectedCount.textContent = selectedAllergens.length;

}


// Seçimleri kaydeder.
saveButton.addEventListener("click", function() {

    localStorage.setItem(
        "allergens",
        JSON.stringify(selectedAllergens)
    );

    statusMessage.textContent = "Seçimlerin başarıyla kaydedildi.";

});


// Bütün seçimleri temizler.
clearButton.addEventListener("click", function() {

    selectedAllergens = [];

    localStorage.removeItem("allergens");

    renderAllergens();

    statusMessage.textContent = "Bütün seçimler temizlendi.";

});


// Sayfa açıldığında kayıtlı seçimleri gösterir.
renderAllergens();
