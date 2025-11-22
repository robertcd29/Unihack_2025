const API_BASE_URL = 'https://parkitsmart.duckdns.org';
let heroContent = document.getElementById("heroContent");
let parkingDetails = document.getElementById("parkingDetails");
let detailsTitle = document.getElementById("detailsTitle");
let detailsDescription = document.getElementById("detailsDescription");
let detailsBadge = document.getElementById("detailsBadge");
let closeDetailsBtn = document.getElementById("closeDetailsBtn");
let detailsDirectionsBtn = document.getElementById("detailsDirectionsBtn");
let detailsReserveBtn = document.getElementById("detailsReserveBtn");
let detailsAvailableSpots = document.getElementById("detailsAvailableSpots");
let detailsLastUpdate = document.getElementById("detailsLastUpdate");
let detailsPricing = document.getElementById("detailsPricing");
let detailsSchedule = document.getElementById("detailsSchedule");
let detailsFacilities = document.getElementById("detailsFacilities");
let searchWrapper = document.querySelector('.search-wrapper');

let parkingShapes = {};

function getParkingTypeName(type) {
    switch(type) {
        case 0: return 'Parcare normală';
        case 1: return 'Pe stradă';
        case 2: return 'Multilevel';
        case 3: return 'Subterană';
        default: return 'Necunoscut';
    }
}

function getParkingTypeColor(type) {
    switch(type) {
        case 0: return { bg: '#4CAF50', text: 'white' };
        case 1: return { bg: '#2196F3', text: 'white' };
        case 2: return { bg: '#FF9800', text: 'white' };
        case 3: return { bg: '#9C27B0', text: 'white' };
        default: return { bg: '#757575', text: 'white' };
    }
}

function getZoneColor(emptySpots, totalSpots) {
    if (emptySpots === 0) return { stroke: "#D32F2F", fill: "#D32F2F" };
    const percentage = (emptySpots / totalSpots) * 100;
    if (percentage > 50) return { stroke: "#388E3C", fill: "#388E3C" };
    else if (percentage > 20) return { stroke: "#F57C00", fill: "#F57C00" };
    else return { stroke: "#c32311ff", fill: "#f0420dff" };
}

function updateZoneColors() {
    zonesData.forEach(zone => {
        const zoneName = zone.parking_name;
        const shape = parkingShapes[zoneName];
        if (shape) {
            const totalSpots = zone.total_spots || (zone.empty_spots + zone.occupied_spots);
            const colors = getZoneColor(zone.empty_spots, totalSpots);
            if (zone.type === 1) shape.setOptions({ strokeColor: colors.stroke });
            else shape.setOptions({ strokeColor: colors.stroke, fillColor: colors.fill });
        }
    });
}

function fetchParkingData() {
    fetch("https://parkitsmart.duckdns.org/api/v1/parcari/all")
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            zonesData = data;
            updateZoneColors();
            if (currentSelectedZone && parkingDetails.style.display !== 'none') {
                const updatedZone = zonesData.find(z => z.parking_name === currentSelectedZone);
                if (updatedZone) updateDetailsInfo(updatedZone);
            }
        })
        .catch(err => console.error(err));
}

function updateDetailsInfo(zoneInfo) {
    const totalSpots = zoneInfo.total_spots || (zoneInfo.empty_spots + zoneInfo.occupied_spots);
    const percentage = totalSpots > 0 ? ((zoneInfo.empty_spots / totalSpots) * 100).toFixed(0) : 0;
    const typeColor = getParkingTypeColor(zoneInfo.type);
    
    const parkingTypeIndicator = `<span style="background: ${typeColor.bg}; color: ${typeColor.text}; padding: 4px 12px; border-radius: 12px; font-size: 12px; white-space: nowrap;">${getParkingTypeName(zoneInfo.type)}</span>`;
    
    detailsTitle.innerHTML = `<span style="word-break: break-word;">${zoneInfo.parking_name.replace(/_/g, ' ')}</span>${parkingTypeIndicator}`;
    detailsDescription.innerHTML = `Parcarea <strong>${zoneInfo.parking_name}</strong> (${getParkingTypeName(zoneInfo.type).toLowerCase()}) are în prezent <strong>${zoneInfo.empty_spots}</strong> locuri libere din <strong>${totalSpots}</strong> disponibile.`;
    detailsAvailableSpots.innerHTML = `<span style="font-size: 24px; font-weight: 700; color: ${zoneInfo.empty_spots > 0 ? '#4CAF50' : '#f44336'}">${zoneInfo.empty_spots}</span><span style="color: #666;"> / ${totalSpots} locuri</span>`;
    detailsPricing.textContent = zoneInfo.price_per_hour >= 0 ? `${zoneInfo.price_per_hour} RON / oră` : `? RON / oră`;
    detailsSchedule.textContent = zoneInfo.schedule || 'Non-stop';
    
    let facilitiesHTML = '';
    if (zoneInfo.has_surveillance || zoneInfo.has_disabled_access || zoneInfo.has_ev_charging) {
        facilitiesHTML = `<div class="facility-tags">${zoneInfo.has_surveillance ? '<span class="facility-tag">📹 Parcare supravegheată</span>' : ''}${zoneInfo.has_disabled_access ? '<span class="facility-tag">♿ Acces persoane dizabilități</span>' : ''}${zoneInfo.has_ev_charging ? '<span class="facility-tag">🔌 Stații încărcare EV</span>' : ''}</div>`;
    } else {
        facilitiesHTML = `<div class="facility-tags"><span class="no-bg">❌</span></div>`;
    }
    detailsFacilities.innerHTML = facilitiesHTML;
    
    const now = new Date();
    detailsLastUpdate.textContent = now.toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (zoneInfo.empty_spots === 0) {
        detailsBadge.textContent = 'COMPLET OCUPAT';
        detailsBadge.className = 'details-badge complet';
        detailsBadge.style.background = '#D32F2F';
        detailsBadge.style.color = 'white';
    } else if (percentage > 50) {
        detailsBadge.textContent = `DISPONIBIL (${percentage}%)`;
        detailsBadge.className = 'details-badge deschis';
        detailsBadge.style.background = '#388E3C';
        detailsBadge.style.color = 'white';
    } else if (percentage > 20) {
        detailsBadge.textContent = `LIMITAT (${percentage}%)`;
        detailsBadge.className = 'details-badge';
        detailsBadge.style.background = '#F57C00';
        detailsBadge.style.color = 'white';
    } else if (percentage > 0) {
        detailsBadge.textContent = `PUȚINE LOCURI (${percentage}%)`;
        detailsBadge.className = 'details-badge';
        detailsBadge.style.background = '#E65100';
        detailsBadge.style.color = 'white';
    }
}

function showParkingDetails(zoneInfo) {
    currentSelectedZone = zoneInfo.parking_name;
    heroContent.style.display = 'none';
    parkingDetails.style.display = 'flex';
    if (searchWrapper) searchWrapper.style.display = 'none';
    updateDetailsInfo(zoneInfo);
}

function hidesParkingDetails() {
    currentSelectedZone = null;
    parkingDetails.style.display = 'none';
    heroContent.style.display = 'block';
    if (searchWrapper) searchWrapper.style.display = 'block';
}

fetchParkingData();
setInterval(fetchParkingData, 3000);

if (closeDetailsBtn) {
    closeDetailsBtn.onclick = (e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        hidesParkingDetails(); 
    };
}

if (detailsDirectionsBtn) {
    detailsDirectionsBtn.onclick = () => {
        const zoneInfo = zonesData.find(z => z.parking_name === currentSelectedZone);
        if (zoneInfo && zoneInfo.coordinates && zoneInfo.coordinates.length > 0) {
            const firstCoord = zoneInfo.coordinates[0];
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${firstCoord.latitude},${firstCoord.longitude}`, '_blank');
        } else {
            const zoneName = detailsTitle.textContent;
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(zoneName + ', Timișoara')}`, '_blank');
        }
    };
}

document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && parkingDetails.style.display !== 'none') hidesParkingDetails();
});

function setupShapeClickListener(shape, zoneName) {
    if (!zoneName) return;
    shape.addListener("click", (event) => {
        if (!zonesData || zonesData.length === 0) { 
            alert('Datele parcărilor nu sunt încă încărcate. Vă rugăm așteptați...'); 
            return; 
        }
        const zoneInfo = zonesData.find(z => z.parking_name && z.parking_name.toLowerCase() === zoneName.toLowerCase());
        if (!zoneInfo) { 
            alert(`Nu am găsit detalii pentru zona: ${zoneName}`); 
            return; 
        }
        showParkingDetails(zoneInfo);
        setTimeout(() => { 
            if (typeof google !== 'undefined' && google.maps && map) 
                google.maps.event.trigger(map, 'resize'); 
        }, 400);
    });
}

function initZone(mapInstance) {
    map = mapInstance;
    const waitForData = setInterval(() => {
        if (zonesData.length > 0) { 
            clearInterval(waitForData); 
            createParkingShapes(); 
        }
    }, 100);
}

function createParkingShapes() {
    zonesData.forEach(zoneData => {
        let coordinates = zoneData.coordinates;
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) return;
        const coords = coordinates.map(coord => ({ lat: coord.latitude, lng: coord.longitude }));
        const totalSpots = zoneData.total_spots || (zoneData.empty_spots + zoneData.occupied_spots) || 0;
        const colors = getZoneColor(zoneData.empty_spots, totalSpots);
        let shape;
        if (zoneData.type === 1) {
            shape = new google.maps.Polyline({ 
                path: coords, 
                strokeColor: colors.stroke, 
                strokeOpacity: 0.9, 
                strokeWeight: 3, 
                map: map 
            });
            shape.addListener('mouseover', () => { shape.setOptions({ strokeWeight: 3.5, strokeOpacity: 1 }); });
            shape.addListener('mouseout', () => { shape.setOptions({ strokeWeight: 3.5, strokeOpacity: 0.9 }); });
        } else {
            shape = new google.maps.Polygon({ 
                paths: coords, 
                strokeColor: colors.stroke, 
                strokeOpacity: 0.8, 
                strokeWeight: 1.5, 
                fillColor: colors.fill, 
                fillOpacity: 0.35, 
                map: map 
            });
            shape.addListener('mouseover', () => { shape.setOptions({ fillOpacity: 0.6, strokeWeight: 1.5 }); });
            shape.addListener('mouseout', () => { shape.setOptions({ fillOpacity: 0.35, strokeWeight: 1.5 }); });
        }
        parkingShapes[zoneData.parking_name] = shape;
        setupShapeClickListener(shape, zoneData.parking_name);
    });
}
