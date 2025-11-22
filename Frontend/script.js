const API_URL = "https://parkitsmart.duckdns.org";
const WS_URL = "wss://parkitsmart.duckdns.org/ws/parking";

let map;
let geocoder;
let marker = null;
let isOnline = true;
let websocket = null;
let reconnectInterval = null;

let zonesData = [];
let polygons = {};
let currentSelectedZone = null;

document.addEventListener("DOMContentLoaded", () => {
    initializeEventListeners();
    handleMobileViewport();
});

function initializeEventListeners() {
    const findBtn = document.getElementById("findParkingBtn");
    const input = document.getElementById("address");
    const myLocationBtn = document.getElementById("myLocationBtn");

    if (findBtn && input) {
        findBtn.addEventListener("click", () => {
            const adresa = input.value.trim();
            if (adresa) {
                geocodeAddress(adresa);
                input.value = "";
            } else {
                showNotification("Introdu o adresă înainte!", "error");
            }
        });
    }

    if (myLocationBtn) {
        myLocationBtn.addEventListener("click", () => {
            goToMyLocation();
        });
    }
}

function handleMobileViewport() {
    const setVH = () => {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', () => {
        setTimeout(setVH, 100);
    });
}

function initMap() {
    const Timisoara = { lat: 45.756177, lng: 21.228237 };
    const mapElement = document.getElementById("map");
    
    if (!mapElement) {
        console.error('Map element not found!');
        return;
    }

    const mapOptions = {
        zoom: 13,
        center: Timisoara,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ],
        gestureHandling: 'greedy',
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false
    };

    try {
        map = new google.maps.Map(mapElement, mapOptions);
        geocoder = new google.maps.Geocoder();
        
        google.maps.event.addListenerOnce(map, "tilesloaded", () => {
            forceMapResize();
            
            if (typeof initZone === "function") {
                initZone(map);
            }
        });

        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                forceMapResize();
            }, 250);
        });

        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                forceMapResize();
            }, 300);
        });

        enableEnterSearch();
        connectWebSocket();
        loadParkingData();
    } catch (error) {
        console.error('Error initializing map:', error);
        showNotification('Eroare la inițializarea hărții', 'error');
    }
}

function forceMapResize() {
    if (map) {
        google.maps.event.trigger(map, 'resize');
        
        const center = map.getCenter();
        if (center) {
            map.setCenter(center);
        }
    }
}

let pingInterval;
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;

function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        reconnectAttempts = 0;
        
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    };
    
    ws.onmessage = (event) => {
        try {
            let data;
            let rawMessage = event.data;
            
            if (typeof rawMessage === 'string' && rawMessage.startsWith('Update: ')) {
                const jsonString = rawMessage.substring(8);
                data = JSON.parse(jsonString);
            } else {
                data = JSON.parse(rawMessage);
            }
            
            if (data.type === 'pong') {
                return;
            }
            
            if (Array.isArray(data)) {
                zonesData = data;

                if (typeof updateZoneColors === "function") {
                    updateZoneColors();
                }

                if (currentSelectedZone && parkingDetails && parkingDetails.style.display !== 'none') {
                    const updatedZone = zonesData.find(z => z.parking_name === currentSelectedZone);
                    if (updatedZone && typeof updateDetailsInfo === "function") {
                        updateDetailsInfo(updatedZone);
                    }
                }
            }
        } catch (err) {
            console.error('Error parsing message:', err);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
        clearInterval(pingInterval);
        
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            setTimeout(connectWebSocket, RECONNECT_DELAY);
        } else {
            fetchParkingData();
        }
    };
}

function loadParkingData() {
    fetch(`${API_URL}/api/v1/parcari/all`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            updateParkingList(data);
            updateStats(data);
        })
        .catch(err => {
            showNotification('Eroare la încărcarea datelor: ' + err.message, 'error');
        });
}

function updateParkingList(data) {
    const lista = document.getElementById('lista-produse');
    if (!lista) return;
    
    lista.innerHTML = '';
    
    data.forEach(p => {
        const li = document.createElement('li');
        const totalSpots = p.total_spots || (p.empty_spots + p.occupied_spots);
        const percentage = totalSpots > 0 ? (p.empty_spots / totalSpots * 100).toFixed(0) : 0;
        
        let statusClass = 'status-full';
        if (percentage > 50) statusClass = 'status-available';
        else if (percentage > 20) statusClass = 'status-limited';
        
        li.innerHTML = `
            <span class="parking-name">${p.parking_name || 'Parking ' + p.parking_number}</span>
            <span class="parking-number">Nr. ${p.parking_number}</span>
            <span class="parking-spots ${statusClass}">
                ${p.empty_spots} / ${totalSpots} disponibile
            </span>
        `;
        li.className = 'parking-list-item';
        li.style.animation = 'fadeIn 0.3s ease-in';
        lista.appendChild(li);
    });
}

function updateStats(data) {
    const totalEmpty = data.reduce((sum, p) => sum + (p.empty_spots || 0), 0);
    const totalOccupied = data.reduce((sum, p) => sum + (p.occupied_spots || 0), 0);
    const totalSpots = totalEmpty + totalOccupied;
    
    const statsEl = document.getElementById('stats-container');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="stat-item">
                <div class="stat-value">${totalEmpty}</div>
                <div class="stat-label">Locuri Libere</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${totalOccupied}</div>
                <div class="stat-label">Locuri Ocupate</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${totalSpots}</div>
                <div class="stat-label">Total Locuri</div>
            </div>
        `;
    }
}

function geocodeAddress(address) {
    if (!geocoder) {
        showNotification("Harta nu este încă încărcată", "error");
        return;
    }

    geocoder.geocode({ address: address + ', Timișoara' }, (results, status) => {
        if (status === "OK" && results[0]) {
            const location = results[0].geometry.location;

            map.setCenter(location);
            map.setZoom(17);

            if (marker) marker.setMap(null);
            marker = new google.maps.Marker({
                map: map,
                position: location,
                title: address,
                animation: google.maps.Animation.DROP
            });

        } else {
            showNotification("Nu am găsit adresa: " + address, 'error');
        }
    });
}

function enableEnterSearch() {
    const input = document.getElementById("address");
    const findBtn = document.getElementById("findParkingBtn");

    if (!input) return;

    input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            if (findBtn) findBtn.click();
        }
    });
}

function addRefreshButton() {
    const refreshBtn = document.createElement('button');
    refreshBtn.innerHTML = 'Actualizează';
    refreshBtn.className = 'refresh-button';
    refreshBtn.onclick = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            showNotification('Folosind actualizări în timp real!', 'info');
        } else {
            loadParkingData();
            showNotification('Date actualizate!', 'success');
        }
    };
    
    const navbar = document.querySelector('.navbar-content');
    if (navbar) {
        navbar.appendChild(refreshBtn);
    }
}

function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    notification.offsetHeight;
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function goToMyLocation() {
    if (!map) {
        showNotification("Harta nu este încă încărcată", "error");
        return;
    }

    if (navigator.geolocation) {
        showNotification("Obținere locație...", "info");
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                map.setCenter(userLocation);
                map.setZoom(16);

                if (marker) marker.setMap(null);

                marker = new google.maps.Marker({
                    map: map,
                    position: userLocation,
                    title: 'Locația ta',
                    animation: google.maps.Animation.DROP,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: '#4285F4',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 3
                    }
                });

                showNotification("Locație găsită!", "success");

                setTimeout(() => {
                    if (marker) {
                        marker.setMap(null);
                        marker = null;
                    }
                }, 15000);
            },
            (error) => {
                let errorMessage = 'Nu s-a putut obține locația ta.';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Accesul la locație a fost refuzat. Permite accesul în setările browser-ului.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Informațiile despre locație nu sunt disponibile.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Timeout la obținerea locației. Încearcă din nou.';
                        break;
                }

                showNotification(errorMessage, 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        showNotification('Geolocation nu este suportat de browser-ul tău.', 'error');
    }
}

window.addEventListener('beforeunload', () => {
    if (ws) {
        ws.close();
    }
    if (pingInterval) {
        clearInterval(pingInterval);
    }
});

const apiScript = document.createElement("script");
apiScript.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&callback=initMap`;
apiScript.async = true;
apiScript.defer = true;
apiScript.onerror = () => {
    showNotification('Eroare la încărcarea hărții Google Maps', 'error');
};
document.head.appendChild(apiScript);

const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .parking-list-item { 
        transition: all 0.3s ease; 
    }
    
    .parking-list-item:hover { 
        transform: translateX(5px); 
    }
    
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
        max-width: calc(100vw - 40px);
        box-sizing: border-box;
    }
    
    .notification.show { 
        opacity: 1; 
        transform: translateY(0); 
    }
    
    .notification-success { 
        background: #4CAF50; 
    }
    
    .notification-error { 
        background: #f44336; 
    }
    
    .notification-info { 
        background: #2196F3; 
    }
    
    .refresh-button {
        padding: 8px 16px;
        background: #016B61;
        color: white;
        border: none;
        border-radius: 20px;
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        transition: all 0.3s ease;
        white-space: nowrap;
    }
    
    .refresh-button:hover {
        background: #015950;
        transform: translateY(-2px);
    }
    
    @media (max-width: 768px) {
        .notification {
            top: 15px;
            right: 15px;
            left: 15px;
            max-width: none;
            font-size: 14px;
            padding: 12px 18px;
        }
        
        .refresh-button {
            padding: 6px 12px;
            font-size: 12px;
        }
    }
`;
document.head.appendChild(style);
