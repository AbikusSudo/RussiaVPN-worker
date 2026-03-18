// VLESS over WebSocket Worker
import { connect } from 'cloudflare:sockets';

// Конфигурация
let subPath = 'RussiaVPN';
let password = 'AbikusSudo';
let yourUUID = 'b0e65791-90eb-55bb-8aef-e8cfed4ce88e';
let fakeSNI = 'sso.yandex.ru';

let serverPool = ['13.230.34.30'];
let cfip = [
    'ip.sb', 'time.is', 'skk.moe', 'www.visa.com.tw', 
    'www.visa.com.hk', 'www.visa.com.sg', 'cf.090227.xyz',
    'cf.877774.xyz', 'cdns.doon.eu.org', 'cf.zhetengsha.eu.org'
];
let dnsResolver = 'https://sky.rethinkdns.com/1:-Pf_____9_8A_AMAIgE8kMABVDDmKOHTAKg=';

function authenticateBasic(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) return false;
    const decoded = atob(authHeader.slice(6));
    const [username, pwd] = decoded.split(':');
    return username === 'RussiaVPN' && pwd === 'AbikusSudo';
}

function parseServerAddress(serverStr) {
    const defaultPort = 443;
    let hostname = serverStr.trim();
    let port = defaultPort;
    if (hostname.includes('.tp')) {
        const portMatch = hostname.match(/\.tp(\d+)\./);
        if (portMatch) port = parseInt(portMatch[1]);
    } else if (hostname.includes('[') && hostname.includes(']:')) {
        port = parseInt(hostname.split(']:')[1]);
        hostname = hostname.split(']:')[0] + ']';
    } else if (hostname.includes(':')) {
        const parts = hostname.split(':');
        port = parseInt(parts[parts.length - 1]);
        hostname = parts.slice(0, -1).join(':');
    }
    return { hostname, port };
}

async function resolveHostname(hostname) {
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || 
        /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(hostname)) {
        return hostname;
    }
    try {
        const dnsResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=${hostname}&type=A`, {
            headers: { 'Accept': 'application/dns-json' }
        });
        if (dnsResponse.ok) {
            const dnsData = await dnsResponse.json();
            if (dnsData.Answer && dnsData.Answer.length > 0) {
                return dnsData.Answer[0].data;
            }
        }
        return hostname;
    } catch (error) {
        return hostname;
    }
}

async function connectWithFailover() {
    const validServers = serverPool.filter(server => server && server.trim() !== '');
    const allServers = [...validServers, 'Kr.tp50000.netlib.re'];
    let lastError = null;
    for (let i = 0; i < allServers.length; i++) {
        try {
            const serverStr = allServers[i];
            const { hostname, port } = parseServerAddress(serverStr);
            const resolvedHostname = await resolveHostname(hostname);
            const socket = await connect({ hostname: resolvedHostname, port });
            return { socket, server: { hostname: resolvedHostname, port, original: serverStr } };
        } catch (error) {
            lastError = error;
            continue;
        }
    }
    throw new Error(`All servers connect failed: ${lastError?.message || 'Unknown error'}`);
}

function obfuscateUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.1 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0.0.0'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

export default {
    async fetch(request, env, ctx) {
        try {
            if (env.PROXYIP || env.proxyip || env.proxyIP) {
                serverPool = (env.PROXYIP || env.proxyip || env.proxyIP).split(',').map(s => s.trim());
            }
            password = env.PASSWORD || env.PASSWD || env.password || password;
            subPath = env.SUB_PATH || env.subpath || subPath;
            yourUUID = env.UUID || env.uuid || env.AUTH || yourUUID;
            dnsResolver = env.DNS_RESOLVER || dnsResolver;

            const upgradeHeader = request.headers.get('Upgrade');
            const url = new URL(request.url);

            if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
                return await VLOverWSHandler(request);
            } else {
                switch (url.pathname) {
                    case '/':
                        return getHomePage(request);
                    case `/${subPath}`:
                        return getSubscription(request);
                    case '/info':
                        return new Response(JSON.stringify(request.cf, null, 4), {
                            status: 200,
                            headers: { "Content-Type": "application/json;charset=utf-8" }
                        });
                    default:
                        const randomSites = cfip.length > 0 ? cfip : [
                            'ip.sb', 'time.is', 'www.apple.com', 'skk.moe',
                            'www.visa.com.tw', 'www.github.com', 'www.ups.com',
                            'www.tesla.com', 'www.microsoft.com', 'www.amazon.com'
                        ];
                        const randomSite = randomSites[Math.floor(Math.random() * randomSites.length)];
                        const Url = new URL(`https://${randomSite}${url.pathname}${url.search}`);
                        const headers = new Headers(request.headers);
                        headers.set('User-Agent', obfuscateUserAgent());
                        headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
                        headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
                        headers.set('Accept-Encoding', 'gzip, deflate, br');
                        headers.set('DNT', '1');
                        headers.set('Connection', 'keep-alive');
                        headers.set('Upgrade-Insecure-Requests', '1');
                        headers.set('Host', randomSite);
                        const UrlRequest = new Request(Url, {
                            method: request.method,
                            headers: headers,
                            body: request.body
                        });
                        try {
                            const response = await fetch(UrlRequest);
                            return response;
                        } catch (error) {
                            return new Response('Service Unavailable', { status: 502 });
                        }
                }
            }
        } catch (err) {
            return new Response('Internal Server Error', { status: 500 });
        }
    },
};

async function VLOverWSHandler(request) {
    const webSocketPair = new WebSocketPair();
    const [client, webSocket] = Object.values(webSocketPair);
    webSocket.accept();
    const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
    const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader);
    let remoteSocketWapper = { value: null };
    let udpStreamWrite = null;
    let isDns = false;

    readableWebSocketStream.pipeTo(new WritableStream({
        async write(chunk, controller) {
            try {
                if (isDns && udpStreamWrite) return udpStreamWrite(chunk);
                if (remoteSocketWapper.value) {
                    const writer = remoteSocketWapper.value.writable.getWriter();
                    await writer.write(chunk);
                    writer.releaseLock();
                    return;
                }
            } catch (writeError) {
                controller.error(writeError);
            }

            const { hasError, message, portRemote = 443, addressRemote = '', rawDataIndex, VLVersion = new Uint8Array([0, 0]), isUDP } = await processVLHeader(chunk, yourUUID);
            if (hasError) throw new Error(message);
            
            if (isUDP) {
                if (portRemote === 53) {
                    isDns = true;
                } else {
                    throw new Error('only enable for DNS which is port 53');
                }
            }
            
            const VLResponseHeader = new Uint8Array([VLVersion[0], 0]);
            const rawClientData = chunk.slice(rawDataIndex);

            if (isDns) {
                const { write } = await handleUDPOutBound(webSocket, VLResponseHeader);
                udpStreamWrite = write;
                udpStreamWrite(rawClientData);
                return;
            }
            handleTCPOutBound(remoteSocketWapper, addressRemote, portRemote, rawClientData, webSocket, VLResponseHeader);
        },
        close() {},
        abort(reason) {}
    })).catch(() => {});

    return new Response(null, { status: 101, webSocket: client });
}

async function handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, VLResponseHeader) {
    async function connectAndWrite(address, port) {
        try {
            const tcpSocket = connect({ hostname: address, port });
            remoteSocket.value = tcpSocket;
            const writer = tcpSocket.writable.getWriter();
            await writer.write(rawClientData);
            writer.releaseLock();
            return tcpSocket;
        } catch (connectError) {
            throw connectError;
        }
    }

    async function retry() {
        try {
            const { socket: tcpSocket } = await connectWithFailover();
            remoteSocket.value = tcpSocket;
            const writer = tcpSocket.writable.getWriter();
            await writer.write(rawClientData);
            writer.releaseLock();
            tcpSocket.closed.catch(() => safeCloseWebSocket(webSocket)).finally(() => safeCloseWebSocket(webSocket));
            remoteSocketToWS(tcpSocket, webSocket, VLResponseHeader, null);
        } catch (retryError) {
            safeCloseWebSocket(webSocket);
        }
    }

    try {
        const tcpSocket = await connectAndWrite(addressRemote, portRemote);
        remoteSocketToWS(tcpSocket, webSocket, VLResponseHeader, retry);
    } catch (connectError) {
        retry();
    }
}

function makeReadableWebSocketStream(webSocketServer, earlyDataHeader) {
    let readableStreamCancel = false;
    const stream = new ReadableStream({
        start(controller) {
            webSocketServer.addEventListener('message', (event) => {
                if (readableStreamCancel) return;
                controller.enqueue(event.data);
            });
            webSocketServer.addEventListener('close', () => {
                safeCloseWebSocket(webSocketServer);
                if (readableStreamCancel) return;
                controller.close();
            });
            webSocketServer.addEventListener('error', (err) => controller.error(err));
            const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
            if (error) controller.error(error);
            else if (earlyData) controller.enqueue(earlyData);
        },
        cancel() {
            if (readableStreamCancel) return;
            readableStreamCancel = true;
            safeCloseWebSocket(webSocketServer);
        }
    });
    return stream;
}

async function processVLHeader(VLBuffer, yourUUID) {
    if (VLBuffer.byteLength < 24) return { hasError: true, message: 'invalid data' };
    
    const version = new Uint8Array(VLBuffer.slice(0, 1));
    let isValidUser = false;
    let isUDP = false;
    const slicedBuffer = new Uint8Array(VLBuffer.slice(1, 17));
    const slicedBufferString = stringify(slicedBuffer);
    const ids = yourUUID.includes(',') ? yourUUID.split(",") : [yourUUID];
    isValidUser = ids.some(id => slicedBufferString === id.trim());
    
    if (!isValidUser) return { hasError: true, message: 'invalid user' };
    
    const optLength = new Uint8Array(VLBuffer.slice(17, 18))[0];
    const command = new Uint8Array(VLBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
    
    if (command === 2) isUDP = true;
    else if (command !== 1) return { hasError: true, message: `command ${command} is not support` };
    
    const portIndex = 18 + optLength + 1;
    const portRemote = new DataView(VLBuffer.slice(portIndex, portIndex + 2)).getUint16(0);
    
    let addressIndex = portIndex + 2;
    const addressType = new Uint8Array(VLBuffer.slice(addressIndex, addressIndex + 1))[0];
    let addressLength = 0;
    let addressValueIndex = addressIndex + 1;
    let addressValue = '';
    
    switch (addressType) {
        case 1:
            addressLength = 4;
            addressValue = new Uint8Array(VLBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
            break;
        case 2:
            addressLength = new Uint8Array(VLBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
            addressValueIndex += 1;
            addressValue = new TextDecoder().decode(VLBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            break;
        case 3:
            addressLength = 16;
            const dataView = new DataView(VLBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            const ipv6 = [];
            for (let i = 0; i < 8; i++) ipv6.push(dataView.getUint16(i * 2).toString(16));
            addressValue = ipv6.join(':');
            break;
        default:
            return { hasError: true, message: `invalid addressType is ${addressType}` };
    }
    
    if (!addressValue) return { hasError: true, message: 'addressValue is empty' };
    
    return {
        hasError: false,
        addressRemote: addressValue,
        addressType,
        portRemote,
        rawDataIndex: addressValueIndex + addressLength,
        VLVersion: version,
        isUDP
    };
}

async function remoteSocketToWS(remoteSocket, webSocket, VLResponseHeader, retry) {
    let VLHeader = VLResponseHeader;
    let hasIncomingData = false;
    await remoteSocket.readable
        .pipeTo(new WritableStream({
            async write(chunk) {
                try {
                    hasIncomingData = true;
                    if (webSocket.readyState !== 1) return;
                    if (VLHeader) {
                        webSocket.send(await new Blob([VLHeader, chunk]).arrayBuffer());
                        VLHeader = null;
                    } else {
                        webSocket.send(chunk);
                    }
                } catch (sendError) {}
            }
        }))
        .catch(() => safeCloseWebSocket(webSocket));
    
    if (hasIncomingData === false && retry) retry();
}

function base64ToArrayBuffer(base64Str) {
    if (!base64Str) return { error: null };
    try {
        base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
        const decode = atob(base64Str);
        const arryBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
        return { earlyData: arryBuffer.buffer, error: null };
    } catch (error) {
        return { error };
    }
}

function isValidAUTH(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;

function safeCloseWebSocket(socket) {
    try {
        if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) {
            socket.close();
        }
    } catch (error) {}
}

const byteToHex = [];
for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 256).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
    return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + 
            byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + 
            byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + 
            byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + 
            byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

function stringify(arr, offset = 0) {
    const id = unsafeStringify(arr, offset);
    if (!isValidAUTH(id)) throw TypeError("Stringified id is invalid");
    return id;
}

async function handleUDPOutBound(webSocket, VLResponseHeader) {
    let isVLHeaderSent = false;
    const transformStream = new TransformStream({
        transform(chunk, controller) {
            for (let index = 0; index < chunk.byteLength;) {
                const lengthBuffer = chunk.slice(index, index + 2);
                const udpPakcetLength = new DataView(lengthBuffer).getUint16(0);
                const udpData = new Uint8Array(chunk.slice(index + 2, index + 2 + udpPakcetLength));
                index = index + 2 + udpPakcetLength;
                controller.enqueue(udpData);
            }
        }
    });

    transformStream.readable.pipeTo(new WritableStream({
        async write(chunk) {
            const resp = await fetch(dnsResolver, {
                method: 'POST',
                headers: { 'content-type': 'application/dns-message' },
                body: chunk
            });
            const dnsQueryResult = await resp.arrayBuffer();
            const udpSize = dnsQueryResult.byteLength;
            const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);
            if (webSocket.readyState === WS_READY_STATE_OPEN) {
                if (isVLHeaderSent) {
                    webSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
                } else {
                    webSocket.send(await new Blob([VLResponseHeader, udpSizeBuffer, dnsQueryResult]).arrayBuffer());
                    isVLHeaderSent = true;
                }
            }
        }
    })).catch(() => {});

    const writer = transformStream.writable.getWriter();
    return { write: (chunk) => writer.write(chunk) };
}

function getVLConfig(yourUUID, url) {
    const wsPath = '/?ed=2560';
    const encodedPath = encodeURIComponent(wsPath);
    const addresses = Array.isArray(cfip) ? cfip : [cfip];
    const header = 'vless';
    return addresses.map(addr => 
        `${header}://${yourUUID}@${addr}:443?encryption=none&security=tls&sni=${fakeSNI}&fp=chrome&type=ws&host=${url}&path=${encodedPath}#Worker`
    ).join('\n');
}

function getHomePage(request) {
    const url = request.headers.get('Host');
    const baseUrl = `https://${url}`;
    const urlObj = new URL(request.url);
    const providedPassword = urlObj.searchParams.get('password');

    if (providedPassword) {
        if (providedPassword === password) {
            return getMainPageContent(url, baseUrl);
        } else {
            return getLoginPage(url, baseUrl, true);
        }
    }
    return getLoginPage(url, baseUrl, false);
}

function getLoginPage(url, baseUrl, showError = false) {
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VLESS Worker</title>
    <style>
        body { font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
        .login-container { background: white; border-radius: 20px; padding: 40px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); max-width: 400px; width: 95%; text-align: center; }
        .logo { font-size: 3rem; margin-bottom: 20px; }
        .title { font-size: 1.8rem; margin-bottom: 8px; color: #2d3748; }
        .subtitle { color: #718096; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; text-align: left; }
        .form-label { display: block; margin-bottom: 8px; font-weight: 600; color: #4a5568; }
        .form-input { width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem; }
        .form-input:focus { outline: none; border-color: #667eea; }
        .btn-login { width: 100%; padding: 12px 20px; background: linear-gradient(45deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; }
        .error-message { background: #fed7d7; color: #c53030; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">🔐</div>
        <h1 class="title">VLESS Worker</h1>
        <p class="subtitle">Введите пароль</p>
        ${showError ? '<div class="error-message">Неверный пароль</div>' : ''}
        <form onsubmit="handleLogin(event)">
            <div class="form-group">
                <label class="form-label">Пароль</label>
                <input type="password" id="password" class="form-input" required autofocus>
            </div>
            <button type="submit" class="btn-login">Войти</button>
        </form>
    </div>
    <script>
        function handleLogin(e) {
            e.preventDefault();
            const url = new URL(window.location);
            url.searchParams.set('password', document.getElementById('password').value);
            window.location.href = url.toString();
        }
    </script>
</body>
</html>`;
    return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html;charset=utf-8' }
    });
}

function getMainPageContent(url, baseUrl) {
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VLESS Worker</title>
    <style>
        body { font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
        .container { background: white; border-radius: 20px; padding: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); max-width: 600px; width: 95%; }
        .logo { font-size: 2.5rem; text-align: center; margin-bottom: 10px; }
        .title { text-align: center; font-size: 1.8rem; color: #2d3748; margin-bottom: 20px; }
        .info-card { background: #f7fafc; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .info-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .info-item:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #4a5568; }
        .value { font-family: monospace; background: #edf2f7; padding: 4px 8px; border-radius: 6px; }
        .btn { padding: 10px 20px; background: linear-gradient(45deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; margin: 5px; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
        .status { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #48bb78; margin-right: 8px; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .toast { position: fixed; top: 20px; right: 20px; background: white; border-left: 4px solid #48bb78; border-radius: 8px; padding: 12px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 10px; z-index: 1000; opacity: 0; transform: translateX(100%); transition: all 0.3s ease; }
        .toast.show { opacity: 1; transform: translateX(0); }
    </style>
</head>
<body>
    <div class="toast" id="toast"><div class="toast-icon">✓</div><div class="toast-message" id="toastMessage"></div></div>
    <button onclick="logout()" style="position:fixed;top:20px;right:20px;padding:8px 16px;">Выйти</button>
    <div class="container">
        <div class="logo">🚀</div>
        <h1 class="title">VLESS Worker</h1>
        <div class="info-card">
            <div class="info-item"><span class="label">Статус</span><span class="value"><span class="status"></span>Работает</span></div>
            <div class="info-item"><span class="label">Хост</span><span class="value">${url}</span></div>
            <div class="info-item"><span class="label">UUID</span><span class="value">${yourUUID}</span></div>
            <div class="info-item"><span class="label">Подписка</span><span class="value">${baseUrl}/${subPath}</span></div>
            <div class="info-item"><span class="label">Подписка (auth)</span><span class="value">https://RussiaVPN:AbikusSudo@${url}/${subPath}</span></div>
        </div>
        <div style="text-align:center">
            <button class="btn" onclick="copyVless()">Копировать VLESS</button>
            <button class="btn" onclick="copySub()">Копировать подписку</button>
        </div>
    </div>
    <script>
        function showToast(msg) { 
            const t=document.getElementById('toast'); 
            document.getElementById('toastMessage').textContent=msg; 
            t.classList.add('show'); 
            setTimeout(()=>t.classList.remove('show'),1500); 
        }
        function copyVless() { 
            const url='vless://${yourUUID}@${url}:443?encryption=none&security=tls&sni=${fakeSNI}&fp=chrome&type=ws&host=${url}&path=%2F${subPath}%3Fed%3D2560#VLESS'; 
            navigator.clipboard.writeText(url).then(()=>showToast('VLESS ссылка скопирована')); 
        }
        function copySub() { 
            navigator.clipboard.writeText('${baseUrl}/${subPath}').then(()=>showToast('Подписка скопирована')); 
        }
        function logout() { 
            const url=new URL(window.location); 
            url.searchParams.delete('password'); 
            window.location.href=url.toString(); 
        }
    </script>
</body>
</html>`;
    return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html;charset=utf-8' }
    });
}

function getSubscription(request) {
    if (!authenticateBasic(request)) {
        return new Response('Unauthorized', {
            status: 401,
            headers: { 'WWW-Authenticate': 'Basic realm="VLESS Subscription"' }
        });
    }
    const url = request.headers.get('Host');
    const VLUrl = getVLConfig(yourUUID, url);
    return new Response(btoa(VLUrl), {
        status: 200,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
}
