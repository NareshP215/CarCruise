// Show page map functionality
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('map')) {
        // Get data from the page
        const mapElement = document.getElementById('map');
        const coordinates = JSON.parse(mapElement.dataset.coordinates || '[78.9629, 20.5937]');
        const title = mapElement.dataset.title || 'Location';
        const location = mapElement.dataset.location || '';
        const country = mapElement.dataset.country || '';
        
        // Initialize map with listing coordinates
        const map = L.map('map').setView([coordinates[1], coordinates[0]], 13);
        
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        // Add marker for the listing location
        const marker = L.marker([coordinates[1], coordinates[0]]).addTo(map);
        
        // Create popup content
        const popupContent = 
            '<div>' +
            '<strong>📍 ' + title + '</strong><hr>' +
            '<p><strong>Location:</strong> ' + location + '</p>' +
            '<p><strong>Country:</strong> ' + country + '</p>' +
            '</div>';
        
        marker.bindPopup(popupContent).openPopup();
    }
}); 