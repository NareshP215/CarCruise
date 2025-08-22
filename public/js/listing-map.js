// Listing Creation Map Functionality
let map, marker, popup;

// Initialize map when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Only initialize if we're on a page with a map
        if (document.getElementById('map')) {
            // Wait a bit to ensure Leaflet is loaded
            setTimeout(() => {
                if (typeof L !== 'undefined') {
                    initMap();
                } else {
                    console.error('Leaflet not available');
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error initializing map:', error);
    }
});

function initMap() {
    try {
        // Initialize map centered on a default location (India)
        map = L.map('map').setView([20.5937, 78.9629], 5);
        
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        marker = L.marker([20.5937, 78.9629]).addTo(map);
        popup = L.popup();

        setupEventListeners();
        makeMarkerDraggable();
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

function setupEventListeners() {
    try {
        // Handle marker drag events
        marker.on('dragend', async (e) => {
            const lat = e.target.getLatLng().lat;
            const lng = e.target.getLatLng().lng;
            
            await handleMarkerMove(lat, lng);
        });

        // Handle geocode button click
        const geocodeBtn = document.getElementById('geocodeBtn');
        if (geocodeBtn) {
            geocodeBtn.addEventListener('click', async () => {
                await handleGeocodeClick();
            });
        }
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

function makeMarkerDraggable() {
    try {
        marker.dragging.enable();
    } catch (error) {
        console.error('Error making marker draggable:', error);
    }
}

async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return null;
    }
}

async function geocodeAddress(address) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
        const data = await response.json();
        return data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

function updateFormFields(addressData) {
    try {
        if (addressData && addressData.address) {
            const address = addressData.address;
            
            // Update location field (city, state, etc.)
            let locationParts = [];
            if (address.city) locationParts.push(address.city);
            if (address.state) locationParts.push(address.state);
            if (address.county) locationParts.push(address.county);
            if (locationParts.length === 0 && address.display_name) {
                // Fallback: use first two parts of display_name
                locationParts = address.display_name.split(',').slice(0, 2);
            }
            
            // Update country field separately
            const country = address.country || '';
            
            const locationField = document.getElementById('location');
            const countryField = document.getElementById('country');
            
            if (locationField) locationField.value = locationParts.join(', ');
            if (countryField) countryField.value = country;
        }
    } catch (error) {
        console.error('Error updating form fields:', error);
    }
}

function updateCoordinates(lat, lng) {
    try {
        const latField = document.getElementById('latitude');
        const lngField = document.getElementById('longitude');
        
        if (latField) latField.value = lat;
        if (lngField) lngField.value = lng;
    } catch (error) {
        console.error('Error updating coordinates:', error);
    }
}

async function handleMarkerMove(lat, lng) {
    try {
        // Update coordinates
        updateCoordinates(lat, lng);
        
        // Reverse geocode and update popup
        const addressData = await reverseGeocode(lat, lng);
        if (addressData) {
            const popupContent = `
                <div>
                    <strong>📍 Selected Location</strong><hr>
                    <p>${addressData.display_name}</p>
                </div>
            `;
            marker.bindPopup(popupContent).openPopup();
            
            // Update form fields
            updateFormFields(addressData);
        }
    } catch (error) {
        console.error('Error handling marker move:', error);
    }
}

async function handleGeocodeClick() {
    try {
        const street = document.getElementById('street')?.value || '';
        const city = document.getElementById('city')?.value || '';
        const country = document.getElementById('country')?.value || '';
        
        if (!street && !city && !country) {
            alert('Please enter at least one address component');
            return;
        }
        
        const address = [street, city, country].filter(Boolean).join(', ');
        const geocodedData = await geocodeAddress(address);
        
        if (geocodedData) {
            const lat = parseFloat(geocodedData.lat);
            const lng = parseFloat(geocodedData.lon);
            
            // Update map and marker
            map.setView([lat, lng], 13);
            marker.setLatLng([lat, lng]);
            
            // Update coordinates
            updateCoordinates(lat, lng);
            
            // Update popup
            const popupContent = `
                <div>
                    <strong>📍 Geocoded Location</strong><hr>
                    <p>${geocodedData.display_name}</p>
                </div>
            `;
            marker.bindPopup(popupContent).openPopup();
            
            // Update form fields with separate location and country
            updateFormFields(geocodedData);
        } else {
            alert('Could not geocode the provided address. Please try a different address or drag the marker manually.');
        }
    } catch (error) {
        console.error('Error handling geocode click:', error);
        alert('Error geocoding address. Please try again.');
    }
} 