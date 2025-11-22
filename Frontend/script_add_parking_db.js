const API_BASE_URL = 'https://parkitsmart.duckdns.org';

let coordinateCount = 0;

function addCoordinate(lat = '', lng = '') {
    coordinateCount++;
    const coordinatesList = document.getElementById('coordinatesList');
    
    const coordinateItem = document.createElement('div');
    coordinateItem.className = 'coordinate-item';
    coordinateItem.innerHTML = `
        <div class="coordinate-inputs">
            <div class="coordinate-input-group">
                <div class="coordinate-label">Latitudine</div>
                <input type="number" 
                       class="coordinate-input lat-input" 
                       placeholder="45.7571" 
                       step="0.000001" 
                       value="${lat}"
                       required>
            </div>
            <div class="coordinate-input-group">
                <div class="coordinate-label">Longitudine</div>
                <input type="number" 
                       class="coordinate-input lng-input" 
                       placeholder="21.2291" 
                       step="0.000001" 
                       value="${lng}"
                       required>
            </div>
        </div>
        <button type="button" class="remove-coordinate-btn" onclick="removeCoordinate(this)">×</button>
    `;
    
    coordinatesList.appendChild(coordinateItem);
}

function removeCoordinate(button) {
    button.parentElement.remove();
}

function parseCoordinates(text) {
    text = text.trim();
    
    let match = text.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    
    match = text.match(/@?(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    
    match = text.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    
    return null;
}

function clearCoordinates() {
    document.getElementById('coordinatesList').innerHTML = '';
}

function addInitialCoordinates(n) {
    clearCoordinates();
    for (let i = 0; i < n; i++) addCoordinate();
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, adding initial coordinates...');
    addInitialCoordinates(3);
    
    document.getElementById('addCoordinateBtn').addEventListener('click', function() {
        addCoordinate();
    });
    
    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminUsername');
        window.location.href = 'admin-login.html';
    });

    document.querySelectorAll('.parking-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.parking-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const helperText = document.getElementById('coordinatesHelpText');
            const coordinatesTitle = document.querySelector('.coordinates-title');
            const parkingType = parseInt(this.getAttribute('data-type'));
            
            switch(parkingType) {
                case 0:
                    addInitialCoordinates(3);
                    helperText.textContent = 'Adaugă minim 3 puncte pentru a delimita zona de parcare. Poți găsi coordonatele pe Google Maps.';
                    coordinatesTitle.innerHTML = 'Coordonate Zonă Parcare';
                    break;
                case 1:
                    addInitialCoordinates(2);
                    helperText.textContent = 'Adaugă minim 2 puncte pentru a defini linia parcării pe stradă. Poți adăuga mai multe puncte pentru o linie curbată.';
                    coordinatesTitle.innerHTML = 'Coordonate Linie Parcare';
                    break;
                case 2:
                    addInitialCoordinates(3);
                    helperText.textContent = 'Adaugă minim 3 puncte pentru a delimita zona parcării multilevel (pe mai multe niveluri).';
                    coordinatesTitle.innerHTML = 'Coordonate Parcare Multilevel';
                    break;
                case 3:
                    addInitialCoordinates(3);
                    helperText.textContent = 'Adaugă minim 3 puncte pentru a delimita zona parcării subterane.';
                    coordinatesTitle.innerHTML = 'Coordonate Parcare Subterană';
                    break;
            }
        });
    });

    document.addEventListener('paste', function(e) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.classList.contains('lat-input') || activeElement.classList.contains('lng-input'))) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const coords = parseCoordinates(pastedText);
            if (coords) {
                const coordinateItem = activeElement.closest('.coordinate-item');
                coordinateItem.querySelector('.lat-input').value = coords.lat;
                coordinateItem.querySelector('.lng-input').value = coords.lng;
                coordinateItem.style.background = '#e8f5e9';
                setTimeout(() => { coordinateItem.style.background = ''; }, 500);
            } else {
                alert('Format invalid! Încearcă: "45.7571, 21.2291" sau link Google Maps');
            }
        }
    });
});

document.getElementById('parkingForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const activeButton = document.querySelector('.parking-type-btn.active');
    const parkingType = activeButton ? parseInt(activeButton.getAttribute('data-type')) : 0;
    
    const coordinatesCount = document.querySelectorAll('.coordinate-item').length;
    const minCoords = (parkingType === 1) ? 2 : 3;
    if (coordinatesCount < minCoords) {
        alert(`Trebuie să adaugi minim ${minCoords} puncte pentru acest tip de parcare!`);
        return;
    }
    
    const coordinates = [];
    document.querySelectorAll('.coordinate-item').forEach((item, index) => {
        const lat = parseFloat(item.querySelector('.lat-input').value);
        const lng = parseFloat(item.querySelector('.lng-input').value);
        if (!isNaN(lat) && !isNaN(lng)) {
            coordinates.push({ latitude: lat, longitude: lng, point_order: index + 1 });
        }
    });
    
    const formData = {
        parking_name: document.getElementById('parkingName').value,
        total_spots: parseInt(document.getElementById('totalSpots').value),
        empty_spots: parseInt(document.getElementById('totalSpots').value),
        price_per_hour: parseFloat(document.getElementById('pricing').value) || 0,
        schedule: document.getElementById('schedule').value || 'Non-stop',
        description: document.getElementById('description').value || '',
        type: parkingType,
        has_surveillance: document.getElementById('hasSurveillance').checked,
        has_disabled_access: document.getElementById('hasDisabledAccess').checked,
        has_ev_charging: document.getElementById('hasEvCharging').checked,
        coordinates: coordinates
    };
    
    console.log('📦 Date trimise către API:', JSON.stringify(formData, null, 2));
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Se trimite...';
    
    fetch(`${API_BASE_URL}/api/v1/parcari`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(res => {
        console.log('📡 Status răspuns:', res.status);
        if (!res.ok) {
            return res.json().then(errData => {
                console.error('❌ Detalii eroare server:', errData);
                throw new Error(`Server error: ${JSON.stringify(errData)}`);
            });
        }
        return res.json();
    })
    .then(data => {
        console.log('✅ Răspuns server:', data);
        const successMessage = document.getElementById('successMessage');
        successMessage.style.display = 'block';
        successMessage.classList.add('show');
        setTimeout(() => { window.location.href = 'main.html'; }, 2000);
    })
    .catch(err => {
        console.error('❌ Eroare:', err);
        alert('Eroare la adăugarea parcării! Verifică consola pentru detalii.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publică Parcarea';
    });
});
