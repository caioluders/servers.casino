let isSearching = false;
let searchTimeout = null;
let currentIPs = [];
let intervalId = null;
let serversFound = 0;

//whole lotta of AI garbagge code that im not gonna touch (:

async function fetchWithTimeout(resource, options) {
    // from here : https://dmitripavlutin.com/timeout-fetch-request/
    const { timeout = 1000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

function int2ip(ipInt) {
    return ((ipInt >>> 24) + '.' + (ipInt >> 16 & 255) + '.' + (ipInt >> 8 & 255) + '.' + (ipInt & 255));
}

function isPrivate(ip) {
    // Split the IP address into its octets
    const octets = ip.split('.').map(Number);

    // Check if we have exactly 4 octets and each is a number between 0 and 255
    if (octets.length !== 4 || octets.some(octet => isNaN(octet) || octet < 0 || octet > 255)) {
        return true;  // Invalid IP format, consider it as private
    }

    // Check for private, reserved, and special-use IP ranges
    return (
        (octets[0] === 0) || // 0.0.0.0 to 0.255.255.255
        (octets[0] === 10) || // 10.0.0.0 to 10.255.255.255
        (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) || // 100.64.0.0 to 100.127.255.255
        (octets[0] === 127) || // 127.0.0.0 to 127.255.255.255
        (octets[0] === 169 && octets[1] === 254) || // 169.254.0.0 to 169.254.255.255
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || // 172.16.0.0 to 172.31.255.255
        (octets[0] === 192 && octets[1] === 0 && octets[2] === 0) || // 192.0.0.0 to 192.0.0.255
        (octets[0] === 192 && octets[1] === 0 && octets[2] === 2) || // 192.0.2.0 to 192.0.2.255
        (octets[0] === 192 && octets[1] === 88 && octets[2] === 99) || // 192.88.99.0 to 192.88.99.255
        (octets[0] === 192 && octets[1] === 168) || // 192.168.0.0 to 192.168.255.255
        (octets[0] === 198 && octets[1] >= 18 && octets[1] <= 19) || // 198.18.0.0 to 198.19.255.255
        (octets[0] === 198 && octets[1] === 51 && octets[2] === 100) || // 198.51.100.0 to 198.51.100.255
        (octets[0] === 203 && octets[1] === 0 && octets[2] === 113) || // 203.0.113.0 to 203.0.113.255
        (octets[0] >= 224) // 224.0.0.0 to 255.255.255.255 (including multicast and reserved)
    );
}

function randomIP() {
    var ip = int2ip(Math.floor(Math.random() * 4294967296));
    if (isPrivate(ip)) return randomIP();
    return ip;
}

async function tryIP(ip, port, protocol, threshold) {
    const url = `${protocol}://${ip}:${port}`;

    try {
        const response = await fetchWithTimeout(url, {
            mode: 'no-cors',
            timeout: 3000
        });

        if (response.type === 'opaque') {
            return { ip, port, protocol, exists: true, message: `${protocol.toUpperCase()} server found and responding.` };
        } else {
            console.log(`Received unexpected response type from ${url}`);
            return { ip, port, protocol, exists: false, message: `Unexpected response from ${protocol.toUpperCase()} server.` };
        }
    } catch (error) {
        if (protocol === 'https') {
            const result = await checkHttpsServerTiming(url, threshold);
            return { ip, port, protocol, ...result };
        } else {
            return { ip, port, protocol, exists: false, message: `Connection timed out. ${protocol.toUpperCase()} server might not exist.` };
        }
    }
}

function updateServerInfo() {
    if (!isSearching) {
        clearInterval(intervalId);
        return;
    }

    const serverInfo = document.getElementById("server_info");
    currentIPs.push(currentIPs.shift());
    serverInfo.textContent = `Searching for servers... ${currentIPs[0]} (Found: ${serversFound})`;
}

function checkHttpsServerTiming(url, threshold = 5000) {
    return new Promise((resolve) => {
        const controller = new AbortController();
        const signal = controller.signal;
        const timeoutId = setTimeout(() => {
            controller.abort();
            resolve({ exists: false, message: 'This HTTPS server might not exist (timeout).' });
        }, threshold);

        const startTime = Date.now(); // performance maybe

        fetch(url, { mode: 'no-cors', signal })
            .then(() => {
                clearTimeout(timeoutId);
                const endTime = Date.now();
                const duration = endTime - startTime;
                resolve({ exists: true, message: 'This HTTPS server is likely to exist.' });
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                const endTime = Date.now();
                const duration = endTime - startTime;
                if (error.name === 'AbortError') {
                    resolve({ exists: false, message: 'This HTTPS server might not exist (timeout).' });
                } else if (duration < threshold) {
                    resolve({ exists: true, message: 'This HTTPS server is LIKELY to exist.' });
                } else {
                    resolve({ exists: false, message: 'This HTTPS server might not exist.' });
                }
            });
    });
}

async function findIP() {
    const port = document.getElementById("port").value;
    const protocol = port == '443' ? 'https' : 'http';
    const threshold = protocol === 'https' ? parseInt(document.getElementById("threshold").value) : 5000;
    
    intervalId = setInterval(updateServerInfo, 500);

    while (isSearching) {
        var ips = new Array(10).fill().map(randomIP);
        currentIPs = ips;
        const results = await Promise.all(ips.map(ip => tryIP(ip, port, protocol, threshold)));
        const found = results.find(r => r.exists);
        if (found) return found;
    }
}

async function searchStep() {
    if (!isSearching) return;

    const result = await findIP();
    if (result) {
        displayResult(result);
        const continuousSearch = document.getElementById("continuousSearch").checked;
        if (!continuousSearch) {
            stopSearch();
            return;
        }
    }
    searchTimeout = setTimeout(searchStep, 100);
}

function displayResult(result) {
    const serverCard = document.getElementById("server_card");
    const spinner = document.getElementById("spinner");
    const serverLink = document.getElementById("server_link");
    const serverInfo = document.getElementById("server_info");

    spinner.style.display = "none";
    const url = `${result.protocol}://${result.ip}:${result.port}`;
    serverLink.href = url;
    serverLink.textContent = url;
    serverLink.style.display = "block";

    serversFound++;
    serverInfo.textContent = `Found: ${serversFound} servers. Latest: ${result.message}`;
    
    const newWindow = window.open(url, '_blank');
}

function updateButton() {
    const toggleButton = document.getElementById("toggleButton");
    if (isSearching) {
        toggleButton.textContent = "Stop";
        toggleButton.classList.remove("primary");
        toggleButton.classList.add("error");
    } else {
        toggleButton.textContent = "Find a Server";
        toggleButton.classList.remove("error");
        toggleButton.classList.add("primary");
    }
}

function toggleSearch() {
    if (!isSearching) {
        startSearch();
    } else {
        stopSearch();
    }
}

function startSearch() {
    isSearching = true;
    serversFound = 0;
    updateButton();
    
    const serverCard = document.getElementById("server_card");
    const spinner = document.getElementById("spinner");
    const serverLink = document.getElementById("server_link");
    const serverInfo = document.getElementById("server_info");
    
    serverCard.classList.remove("view_site");
    spinner.style.display = "block";
    serverLink.style.display = "none";
    serverInfo.textContent = "Searching for servers...";

    searchStep();
}

function stopSearch() {
    isSearching = false;
    if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
    }
    updateButton();
    
    const spinner = document.getElementById("spinner");
    const serverInfo = document.getElementById("server_info");
    
    spinner.style.display = "none";
    serverInfo.textContent = `Search stopped. Found ${serversFound} servers.`;
}

// Set default port based on current protocol
document.addEventListener('DOMContentLoaded', function() {
    const portInput = document.getElementById("port");
    const thresholdRow = document.getElementById("thresholdRow");
    const warningHttps = document.getElementById("httpsWarning");
    portInput.value = window.location.protocol === 'https:' ? '443' : '80';
    thresholdRow.style.display = window.location.protocol === 'https:' ? 'flex' : 'none';
    warningHttps.style.display = window.location.protocol === 'https:' ? 'block' : 'none';
    
    portInput.addEventListener('change', function() {
        thresholdRow.style.display = portInput.value === '443' ? 'flex' : 'none';
        warningHttps.style.display = portInput.value === '443' ? 'block' : 'none';
    });
});
