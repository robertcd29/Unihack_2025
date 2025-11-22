const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

togglePassword.addEventListener("click", () => {
    const hidden = passwordInput.type === "password";
    passwordInput.type = hidden ? "text" : "password";
    togglePassword.textContent = hidden ? "Hide" : "Show";
});

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Se autentifică...';
    errorMessage.classList.remove('show');
    
    try {
        console.log('🔐 Trimit request de login...');
        
        const response = await fetch('https://parkitsmart.duckdns.org/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        });
        
        console.log('📡 Response status:', response.status);
        const data = await response.json();
        console.log('📦 Response data:', data);
        
        if (response.ok && data.success) {
            console.log('✅ Login reușit!');
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem('adminToken', data.token);
            storage.setItem('adminUsername', data.username);
            loginBtn.textContent = 'Autentificat!';
            loginBtn.style.background = '#ABE7B2';
            setTimeout(() => { window.location.href = 'add-parking.html'; }, 500);
        } else {
            console.error('❌ Login eșuat:', data.message);
            errorMessage.textContent = data.message || 'Username sau parolă greșită!';
            errorMessage.classList.add('show');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Autentificare';
        }
    } catch (error) {
        console.error('❌ Eroare la login:', error);
        errorMessage.textContent = 'Eroare de conexiune! Verifică dacă serverul rulează.';
        errorMessage.classList.add('show');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Autentificare';
    }
});

document.getElementById('username').addEventListener('input', function() {
    document.getElementById('errorMessage').classList.remove('show');
});

document.getElementById('password').addEventListener('input', function() {
    document.getElementById('errorMessage').classList.remove('show');
});

window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    if (token) {
        console.log('✅ Token găsit, verificăm validitatea...');
        fetch('https://parkitsmart.duckdns.org/admin/verify', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (response.ok) {
                console.log('✅ Token valid, redirecting...');
                window.location.href = 'add-parking.html';
            } else {
                console.log('⚠️  Token invalid, ștergem din storage');
                localStorage.removeItem('adminToken');
                sessionStorage.removeItem('adminToken');
            }
        })
        .catch(err => {
            console.error('❌ Eroare la verificare token:', err);
        });
    }
});
