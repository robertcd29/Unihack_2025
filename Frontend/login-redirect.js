document.getElementById('addParkingBtn').addEventListener('click', function() {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
            
    if (token) {
        window.location.href = 'add-parking.html';
    } else {
        window.location.href = 'admin-login.html';
    }
});
