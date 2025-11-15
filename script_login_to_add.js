window.addEventListener('DOMContentLoaded', function() {
            const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
            
            if (!token) {
                window.location.href = 'admin-login.html';
            }
        });

