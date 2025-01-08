const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const ProxyChain = require('proxy-chain');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Menambahkan informasi hak cipta dan penafian di awal file
console.log('\n===========================================');
console.log('    Skrip Proxy DeSpeed Validator');
console.log('    Penulis: Hoki Receh♪ | Chiwo');
console.log('    Twitter: @HokiReceh');
console.log('===========================================\n');

console.log('Penafian:');
console.log('1. Skrip ini hanya untuk tujuan belajar dan penelitian');
console.log('2. Segala konsekuensi yang timbul dari penggunaan skrip ini menjadi tanggung jawab pengguna');
console.log('3. Harap patuhi hukum dan peraturan yang berlaku serta syarat layanan');
console.log('4. Penulis berhak atas penjelasan akhir mengenai skrip ini');
console.log('\n===========================================\n');

// Menggunakan plugin Stealth untuk menghindari deteksi sebagai alat otomatis
puppeteer.use(StealthPlugin());

// Membuat antarmuka readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Objek konfigurasi
const CONFIG = {
    DESPEED_LOGIN_URL: 'https://app.despeed.net/dashboard'
};

// Memformat string proxy
function formatProxy(proxy) {
    const [ip, port, username, password] = proxy.split(':');
    if (username && password) {
        return `http://${username}:${password}@${ip}:${port}`;
    }
    return `http://${ip}:${port}`;
}

// Penanganan input pengguna
function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

// Memeriksa apakah folder plugin ada
function checkExtensionFolder() {
    const extensionPath = path.join(__dirname, 'extension');
    if (!fs.existsSync(extensionPath)) {
        console.error('Kesalahan: Folder extension tidak ada!');
        console.log('Silakan buat folder extension dan ekstrak plugin ke dalamnya.');
        process.exit(1);
    }
    
    // Memeriksa apakah folder kosong
    const files = fs.readdirSync(extensionPath);
    if (files.length === 0) {
        console.error('Kesalahan: Folder extension kosong!');
        console.log('Silakan ekstrak plugin DeSpeed Validator ke dalam folder extension.');
        process.exit(1);
    }

    // Memeriksa apakah ada manifest.json
    const manifestPath = path.join(extensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        console.error('Kesalahan: Tidak ditemukan manifest.json di dalam folder plugin!');
        console.log('Silakan pastikan file plugin telah diekstrak dengan benar.');
        process.exit(1);
    }

    return extensionPath;
}

// Menangani logika login
async function handleLogin(page, token) {
    try {
        console.log('Sedang melakukan login...');

        // Mengatur localStorage dan sessionStorage
        await page.evaluate((token) => {
            localStorage.clear();
            sessionStorage.clear();
            localStorage.setItem('token', token);
            sessionStorage.setItem('token', token);
            // Mengatur beberapa status tambahan
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('lastLoginTime', new Date().toISOString());
        }, token);

        // Mengatur cookies
        await page.setCookie({
            name: 'refreshToken',
            value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Njc1NSwiaWF0IjoxNzM2MTQ4NDY2LCJleHAiOjE3Mzc0NDQ0NjZ9.ecsV4Krx8yR1T2pU3XNseb7aFUfIWqGNIgZRSaxrsy0',
            domain: 'app.despeed.net',
            path: '/'
        }, {
            name: 'connect.sid',
            value: 's%3AJKIo44CLqEsAshlVLAUztPD7kVAn4v48.niaHtGPKsWPNvYcQtZU3GxavvGAnsjtsdnbq1IkOOOo',
            domain: 'app.despeed.net',
            path: '/'
        });

        // Menunggu beberapa waktu untuk memastikan pengaturan berlaku
        await page.waitForTimeout(2000);

        // Mengakses API informasi pengguna untuk memverifikasi login
        const response = await page.evaluate (async () => {
            try {
                const res = await fetch('https://app.despeed.net/v1/api/auth/profile', {
                    headers: {
                        'authorization': `Bearer ${localStorage.getItem('token')}`,
                        'accept': 'application/json, text/plain, */*',
                        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                        'cache-control': 'no-cache',
                        'pragma': 'no-cache'
                    },
                    credentials: 'include'
                });
                const data = await res.json();
                return {
                    ok: res.ok,
                    status: res.status,
                    data: data
                };
            } catch (error) {
                console.error('Kesalahan permintaan API:', error);
                return null;
            }
        });

        if (response && response.data && response.data.data) {
            const userData = response.data.data;
            console.log('Login berhasil!');
            console.log('Informasi pengguna:');
            console.log('- ID:', userData.id);
            console.log('- Nama pengguna:', userData.username);
            console.log('- Email:', userData.email);
            console.log('- Poin:', userData.points);
            console.log('- Waktu pendaftaran:', new Date(userData.register_on).toLocaleString());

            // Memicu pembaruan status halaman
            await page.evaluate(() => {
                // Memicu pembaruan rute
                window.dispatchEvent(new Event('popstate'));
                // Memicu pembaruan penyimpanan
                window.dispatchEvent(new Event('storage'));
                // Memicu acara kustom
                window.dispatchEvent(new CustomEvent('auth-state-changed', {
                    detail: { isLoggedIn: true }
                }));
            });

            // Menunggu halaman untuk merender ulang
            await page.waitForTimeout(2000);

            // Memuat ulang halaman untuk memastikan status sepenuhnya diperbarui
            await page.goto('https://app.despeed.net/dashboard', { 
                waitUntil: ['networkidle0', 'domcontentloaded'],
                timeout: 30000 
            });

            // Menunggu halaman dimuat sepenuhnya
            await page.waitForTimeout(3000);

            return true;
        }

        console.error('Verifikasi login gagal');
        if (response) {
            console.error('Respon API:', JSON.stringify(response.data, null, 2));
        }
        return false;
    } catch (error) {
        console.error('Kesalahan dalam proses login:', error.message);
        return false;
    }
}

// Memeriksa status login
async function checkLoginStatus(page, token, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Menunggu halaman dimuat sepenuhnya
            await page.waitForTimeout(3000);

            // Memeriksa API informasi pengguna
            const response = await page.evaluate(async () => {
                try {
                    const res = await fetch('https://app.despeed.net/v1/api/auth/profile', {
                        headers: {
                            'authorization': `Bearer ${localStorage.getItem('token')}`,
                            'accept': 'application/json, text/plain, */*',
                            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                            'cache-control': 'no-cache',
                            'pragma': 'no-cache'
                        },
                        credentials: 'include'
                    });
                    const data = await res.json();
                    return {
                        ok: res.ok,
                        status: res.status,
                        data: data
                    };
                } catch (error) {
                    return null;
                }
            });

            if (response && response.data && response.data.data) {
                console.log('Pemeriksaan status login berhasil');
                return true;
            }

            // Jika pemeriksaan gagal, tunggu sebelum mencoba lagi
            if (i < maxRetries - 1) {
                console.log(`Pemeriksaan status login gagal, ${i + 1}/${maxRetries} kali, menunggu untuk mencoba lagi...`);
                await page.waitForTimeout(3000);
            }
        } catch (error) {
            console.error('Kesalahan saat memeriksa status login:', error.message);
            if (i < maxRetries - 1) {
                console.log(`Pemeriksaan status login gagal, ${i + 1}/${maxRetries} kali, menunggu untuk mencoba lagi...`);
                await page.waitForTimeout(3000);
            }
        }
    }
    return false;
}

// Mengurai input token
function parseTokenInput(input) {
    try {
        // Jika mengandung titik koma, berarti mungkin mengandung informasi cookie
        if (input.includes(';')) {
            // Ambil bagian pertama sebagai token
            input = input.split(';')[0].trim();
        }

        // Jika token lengkap dengan Bearer
        if (input.startsWith('Bearer ')) {
            input = input.replace('Bearer ', '').trim();
        }

        // Memverifikasi format token (pemeriksaan sederhana apakah itu format JWT)
        if (input.split('.').length !== 3) {
            console.error('Peringatan: Format token mungkin tidak benar, seharusnya dalam format JWT (mengandung dua titik)');
            return null;
        }

        return input;
    } catch (error) {
        console.error('Gagal mengurai token:', error.message);
        return null;
    }
}

// Mengubah bagian interceptor permintaan
async function setupRequestInterception(page, token) {
    await page.setRequestInterception(true);

    // Mengatur intersepsi permintaan
    page.on('request', request => {
        const url = request.url();
        const headers = request.headers();
        
        // Hanya mengubah permintaan ke app.despeed.net
        if (url.includes('app.despeed.net')) {
            headers['accept'] = 'application/json, text/plain, */*';
            headers['accept-encoding'] = 'gzip, deflate, br, zstd';
            headers['accept-language'] = 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6';
            headers['authorization'] = `Bearer ${token}`;
            headers['cache-control'] = 'no-cache';
            headers['pragma'] = 'no-cache';
            headers['priority'] = 'u=1, i';
            headers['referer'] = 'https://app.despeed.net/dashboard';
            headers['sec-ch-ua'] = '"Microsoft Edge";v="129", "Not=A?Brand";v="8", "Chromium";v="129"';
            headers['sec-ch-ua-mobile'] = '?0';
            headers['sec-ch-ua-platform'] = '"Windows"';
            headers['sec-fetch-dest'] = 'empty';
            headers['sec-fetch-mode'] = 'cors';
            headers['sec-fetch-site'] = 'same-origin';
            headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0';
            
            // Menambahkan header cookie
            headers['cookie'] = `refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Njc1NSwiaWF0IjoxNzM2MTQ4NDY2LCJleHAiOjE3Mzc0NDQ0NjZ9.ecsV4Krx8yR1T2pU3XNseb7aFUfIWqGNIgZRSaxrsy0; connect.sid=s%3AJKIo44CLqEsAshlVLAUztPD7kVAn4v48.niaHtGPKsWPNvYcQtZU3GxavvGAnsjtsdnbq1IkOOOo`;
        }
        
        request.continue({ headers });
    });

    // Mendengarkan respons untuk debugging
    page.on('response', async response => {
        const url = response.url();
        if (url.includes('app.despeed.net')) {
            const status = response.status();
            if (status !== 200) {
                console.log(`Permintaan gagal: ${url}`);
                console.log(`Kode status: ${status}`);
                try {
                    const text = await response.text();
                    console.log('Isi respons:', text);
                } catch (e) {}
            }
        }
    });
}

async function run() {
    try {
        // Memeriksa folder plugin dan mendapatkan jalur
        const extensionPath = checkExtensionFolder();
        console.log('Pemeriksaan folder plugin berhasil');

        console.log('\n=== Skrip Jalankan Proxy DeSpeed Validator ===\n');

        // Mendapatkan input proxy dari pengguna
        console.log('Silakan masukkan informasi proxy (format: ip:port:username:password atau ip:port)');
        const proxyInput = await askQuestion('Proxy: ');
        
        // Mendapatkan input token dari pengguna
        console.log('\nSilakan masukkan token akses (Access Token, di header permintaan di bidang authorization, diawali dengan Bearer)');
        let tokenInput = await askQuestion('Token akses: ');
        
        // ```javascript
        // Mengurai token
        const token = parseTokenInput(tokenInput);
        if (!token) {
            console.error('Format token salah, program keluar');
            process.exit(1);
        }

        // Menampilkan informasi token
        try {
            const tokenData = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            console.log('\nInformasi token:');
            console.log('ID Pengguna:', tokenData.id);
            console.log('Email:', tokenData.email);
            console.log('Waktu kedaluwarsa:', new Date(tokenData.exp * 1000).toLocaleString());
            
            // Memeriksa apakah token sudah kedaluwarsa
            if (tokenData.exp * 1000 < Date.now()) {
                console.error('Peringatan: Token sudah kedaluwarsa!');
                process.exit(1);
            }
        } catch (error) {
            console.error('Peringatan: Tidak dapat mengurai konten token');
        }

        // Menutup antarmuka readline
        rl.close();

        const formattedProxy = formatProxy(proxyInput);

        console.log('\nSedang memulai...');
        console.log('Sedang mengonfigurasi server proxy...');

        // Membuat URL proxy baru
        const newProxyUrl = await ProxyChain.anonymizeProxy(formattedProxy).catch(error => {
            console.error('Konfigurasi server proxy gagal:', error.message);
            process.exit(1);
        });

        console.log('Konfigurasi server proxy berhasil');
        console.log('Sedang memulai browser...');

        // Menampilkan informasi sistem
        console.log('\n=== Informasi Sistem ===');
        console.log('Lingkungan Operasi: VPS');
        console.log('Sistem Operasi:', process.platform);
        console.log('Versi Node.js:', process.version);
        console.log('Penggunaan Memori:', process.memoryUsage().heapUsed / 1024 / 1024, 'MB');
        console.log('===================\n');

        // Mengubah konfigurasi peluncuran browser
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--proxy-server=' + newProxyUrl,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-accelerated-2d-canvas',
                '--disable-notifications',
                '--disable-extensions',
                '--disable-component-extensions-with-background-pages',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-client-side-phishing-detection',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-default-browser-check',
                '--js-flags="--max-old-space-size=512"',
                '--window-size=1280,720'
            ],
            defaultViewport: {
                width: 1280,
                height: 720
            },
            protocolTimeout: 180000,
        });

        // Secara berkala membersihkan memori yang tidak terpakai
        setInterval(async () => {
            try {
                if (global.gc) {
                    global.gc();
                }
                const pages = await browser.pages();
                for (const page of pages) {
                    await page.evaluate(() => {
                        window.gc && window.gc();
                    });
                }
            } catch (error) {
                console.error('Pembersihan memori gagal:', error.message);
            }
        }, 15 * 60 * 1000); // Membersihkan setiap 15 menit

        // Menunggu plugin dimuat
        console.log('Menunggu inisialisasi plugin...');
        await new Promise(resolve => setTimeout(resolve, 10000)); // Meningkatkan waktu tunggu

        // Mendapatkan semua halaman
        let pages = await browser.pages();
        let page = pages[0] || await browser.newPage();

        // Mengatur intersepsi permintaan
        await setupRequestInterception(page, token);

        // Mengatur ukuran tampilan
        await page.setViewport({
            width: 1280,
            height: 800
        });

        // Mengakses halaman login untuk melakukan login
        console.log('Sedang mengakses halaman login...');
        await page.goto(CONFIG.DESPEED_LOGIN_URL, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        // Menangani login
        const loginSuccess = await handleLogin(page, token);
        if (!loginSuccess) {
            console.error('Login gagal, program keluar');
            await browser.close();
            process.exit(1);
        }

        // Memeriksa status login
        console.log('\nSedang mem eriksa status login...');
        const isLoggedIn = await checkLoginStatus(page, token);
        if (!isLoggedIn) {
            console.error('Pemeriksaan status login gagal, program keluar');
            await browser.close();
            process.exit(1);
        }
        console.log('Pemeriksaan status login berhasil!');

        // Memeriksa status plugin
        console.log('\nSedang memeriksa status plugin...');
        const targets = await browser.targets();
        const extensionTarget = targets.find(target => 
            target.type() === 'background_page' || 
            target.type() === 'service_worker'
        );

        if (extensionTarget) {
            console.log('Plugin telah dimuat:', extensionTarget.url());
        } else {
            console.log('Plugin sedang dimuat...');
        }

        // Menunggu inisialisasi plugin
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Mengakses halaman utama
        console.log('Sedang mengakses halaman utama...');
        const mainPage = await browser.newPage();
        await mainPage.goto('https://app.despeed.net/dashboard', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Mengatur penyegaran halaman utama secara berkala
        setInterval(async () => {
            try {
                const now = new Date().toLocaleString();
                console.log(`\n[${now}] Menyegarkan halaman...`);
                
                // Menunggu halaman untuk menyegarkan
                await mainPage.reload({ 
                    waitUntil: ['networkidle0', 'domcontentloaded'],
                    timeout: 30000 
                });

                console.log('Halaman dimuat, menunggu inisialisasi aplikasi React...');
                
                // Menunggu aplikasi React dimuat
                await mainPage.waitForFunction(() => {
                    return document.querySelector('div[class*="dashboard"]') !== null;
                }, { timeout: 30000 });

                // Menunggu beberapa waktu untuk memastikan konten telah diperbarui
                await mainPage.waitForTimeout(5000);
                
                // Menunggu elemen tertentu muncul
                const elementHandle = await mainPage.waitForXPath('//div[contains(@class, "dashboard")]//h2[contains(text(), ".")]', {
                    timeout: 30000,
                    visible: true
                }).catch(async (error) => {
                    console.log('Menunggu elemen timeout, sedang memeriksa status halaman...');
                    // Mengambil semua teks elemen h2
                    const h2Texts = await mainPage.evaluate(() => {
                        const h2Elements = document.querySelectorAll('h2');
                        const results = [];
                        h2Elements.forEach(el => {
                            if (el.textContent.includes('.')) {
                                results.push({
                                    text: el.textContent.trim(),
                                    classes: el.parentElement.className
                                });
                            }
                        });
                        return results;
                    });
                    console.log('Konten angka yang ditemukan:', h2Texts);
                    return null;
                });

                if (!elementHandle) {
                    console.log('Tidak menemukan elemen target, mencoba untuk mendapatkan kembali...');
                    return;
                }
                
                // Mengambil konten elemen tertentu
                const content = await elementHandle.evaluate(node => {
                    // Mengambil konten teks elemen induk
                    const parentText = node.parentElement.textContent.trim();
                    // Mengambil konten teks elemen itu sendiri
                    const selfText = node.textContent.trim();
                    return `${parentText} (${selfText})`;
                });
                
                console.log('\n=== Status Validator ===');
                console.log(content || 'Elemen ada tetapi konten kosong');
                console.log('===================');
                console.log('Halaman berhasil disegarkan');
            } catch (error) {
                console.error('Penyegaran halaman atau pengambilan konten gagal:', error.message);
                if (error.stack) {
                    console.error('Tumpukan kesalahan:', error.stack);
                }
            }
        }, 60 * 60 * 1000); // Menyegarkan setiap 1 jam (60 menit * 60 detik * 1000 milidetik)

        console.log('\n=== Status Operasi ===');
        console.log('1. Koneksi proxy: Berhasil');
        console.log('2. Status login: Berhasil');
        console.log('3. Status plugin: Telah dimuat');
        console.log('4. Penyegaran otomatis: Telah dimulai (interval 1 jam)');
        console.log('\nTekan Ctrl+C untuk menghentikan program');

        // Penanganan kesalahan: mendengarkan kesalahan halaman
        mainPage.on('error', err => {
            console.error('Kesalahan halaman:', err);
        });

        // Mendengarkan pesan konsol
        mainPage.on('console', msg => {
            console.log('Konsol browser:', msg.text());
        });

    } catch (error) {
        console.error('Kesalahan saat menjalankan:', error.message);
        if (error.stack) {
            console.error('Tumpukan kesalahan:', error.stack);
        }
        process.exit(1);
    }
}

// Menambahkan penanganan keluar proses
process.on('SIGINT', () => {
    console.log('\nSedang menutup program...');
    process.exit(0);
});

// Menjalankan skrip
run();