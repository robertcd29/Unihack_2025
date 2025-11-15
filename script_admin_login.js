const togglePassword = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('password');

        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🙈';
        });

        // Handle login
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;
            const loginBtn = document.getElementById('loginBtn');
            const errorMessage = document.getElementById('errorMessage');
            
            // Disable button
            loginBtn.disabled = true;
            loginBtn.textContent = '⏳ Se autentifică...';
            
            // Hide previous error
            errorMessage.classList.remove('show');

            try {
                // Aici faci request către backend-ul tău pentru autentificare
                const response = await fetch('http://192.168.1.164:8000/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    // Salvează token-ul în localStorage sau sessionStorage
                    if (rememberMe) {
                        localStorage.setItem('adminToken', data.token || 'admin_authenticated');
                        localStorage.setItem('adminUsername', username);
                    } else {
                        sessionStorage.setItem('adminToken', data.token || 'admin_authenticated');
                        sessionStorage.setItem('adminUsername', username);
                    }
                    
                    // Redirect to add parking page
                    window.location.href = 'add-parking.html';
                } else {
                    // Show error message
                    errorMessage.classList.add('show');
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Autentificare';
                }
            } catch (error) {
                console.error('Login error:', error);
                
                // Pentru dezvoltare - permite login cu credențiale hardcodate
                // ⚠️ ȘTERGE ACEST BLOC ÎN PRODUCȚIE!
                if (username === 'admin' && password === 'admin123') {
                    if (rememberMe) {
                        localStorage.setItem('adminToken', 'admin_authenticated');
                        localStorage.setItem('adminUsername', username);
                    } else {
                        sessionStorage.setItem('adminToken', 'admin_authenticated');
                        sessionStorage.setItem('adminUsername', username);
                    }
                    window.location.href = 'add-parking.html';
                } else {
                    errorMessage.classList.add('show');
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Autentificare';
                }
            }
        });

        // Clear error on input
        document.getElementById('username').addEventListener('input', function() {
            document.getElementById('errorMessage').classList.remove('show');
        });

        document.getElementById('password').addEventListener('input', function() {
            document.getElementById('errorMessage').classList.remove('show');
        });