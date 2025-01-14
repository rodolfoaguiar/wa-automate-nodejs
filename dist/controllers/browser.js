"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kill = exports.injectApi = exports.injectWapi = exports.injectPreApiScripts = exports.addScript = exports.getSessionDataFilePath = exports.invalidateSesssionData = exports.deleteSessionData = exports.initPage = exports.BROWSER_START_TS = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const death_1 = __importDefault(require("death"));
// import puppeteer from 'puppeteer-extra';
const puppeteer_config_1 = require("../config/puppeteer.config");
const puppeteer_1 = require("puppeteer");
const events_1 = require("./events");
const pico_s3_1 = require("pico-s3");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const puppeteer = require('puppeteer-extra');
const promise_1 = __importDefault(require("terminate/promise"));
const logging_1 = require("../logging/logging");
const tools_1 = require("../utils/tools");
const script_preloader_1 = require("./script_preloader");
const patch_manager_1 = require("./patch_manager");
const init_patch_1 = require("./init_patch");
let browser, wapiInjected = false, pageCache = undefined, wapiAttempts = 1;
exports.BROWSER_START_TS = 0;
function initPage(sessionId, config, qrManager, customUserAgent, spinner, _page, skipAuth) {
    var _a, _b, _c, _d, _e;
    return __awaiter(this, void 0, void 0, function* () {
        const setupPromises = [];
        yield script_preloader_1.scriptLoader.loadScripts();
        if ((config === null || config === void 0 ? void 0 : config.resizable) === undefined || !(config === null || config === void 0 ? void 0 : config.resizable) == false)
            config.defaultViewport = null;
        if (config === null || config === void 0 ? void 0 : config.useStealth) {
            const { default: stealth } = yield Promise.resolve().then(() => __importStar(require('puppeteer-extra-plugin-stealth')));
            puppeteer.use(stealth());
        }
        let waPage = _page;
        if (!waPage) {
            spinner === null || spinner === void 0 ? void 0 : spinner.info('Launching Browser');
            const startBrowser = (0, tools_1.now)();
            browser = yield initBrowser(sessionId, config, spinner);
            spinner === null || spinner === void 0 ? void 0 : spinner.info(`Browser launched: ${((0, tools_1.now)() - startBrowser).toFixed(0)}ms`);
            waPage = yield getWAPage(browser);
        }
        //@ts-ignore
        yield (typeof waPage._client === 'function' && waPage._client() || waPage._client).send('Network.setBypassServiceWorker', { bypass: true });
        const postBrowserLaunchTs = (0, tools_1.now)();
        waPage.on("framenavigated", (frame) => __awaiter(this, void 0, void 0, function* () {
            try {
                const frameNavPromises = [];
                const content = yield frame.content();
                const webpPackKey = (((content.match(/self.(?:.*)=self.*\|\|\[\]/g) || [])[0] || "").match(/self.*\w?=/g) || [""])[0].replace("=", "").replace("self.", "") || false;
                logging_1.log.info(`FRAME NAV, ${frame.url()}, ${webpPackKey}`);
                if (webpPackKey) {
                    frameNavPromises.push(injectApi(waPage, spinner, true));
                    frameNavPromises.push(qrManager.waitFirstQr(waPage, config, spinner));
                }
                if (frame.url().includes('post_logout=1')) {
                    console.log("Session most likely logged out");
                }
                yield Promise.all(frameNavPromises);
            }
            catch (error) {
                logging_1.log.error('framenaverr', error);
            }
        }));
        spinner === null || spinner === void 0 ? void 0 : spinner.info('Setting Up Page');
        if (config === null || config === void 0 ? void 0 : config.proxyServerCredentials) {
            yield waPage.authenticate(config.proxyServerCredentials);
        }
        setupPromises.push(waPage.setUserAgent(customUserAgent || puppeteer_config_1.useragent));
        if ((config === null || config === void 0 ? void 0 : config.defaultViewport) !== null)
            setupPromises.push(waPage.setViewport({
                width: ((_a = config === null || config === void 0 ? void 0 : config.viewport) === null || _a === void 0 ? void 0 : _a.width) || puppeteer_config_1.width,
                height: ((_b = config === null || config === void 0 ? void 0 : config.viewport) === null || _b === void 0 ? void 0 : _b.height) || puppeteer_config_1.height,
                deviceScaleFactor: 1
            }));
        const cacheEnabled = (config === null || config === void 0 ? void 0 : config.cacheEnabled) === false ? false : true;
        const blockCrashLogs = (config === null || config === void 0 ? void 0 : config.blockCrashLogs) === false ? false : true;
        setupPromises.push(waPage.setBypassCSP((config === null || config === void 0 ? void 0 : config.bypassCSP) || false));
        setupPromises.push(waPage.setCacheEnabled(cacheEnabled));
        const blockAssets = !(config === null || config === void 0 ? void 0 : config.headless) ? false : (config === null || config === void 0 ? void 0 : config.blockAssets) || false;
        if (blockAssets) {
            const { default: block } = yield Promise.resolve().then(() => __importStar(require('puppeteer-extra-plugin-block-resources')));
            puppeteer.use(block({
                blockedTypes: new Set(['image', 'stylesheet', 'font'])
            }));
        }
        const interceptAuthentication = !(config === null || config === void 0 ? void 0 : config.safeMode);
        const proxyAddr = (config === null || config === void 0 ? void 0 : config.proxyServerCredentials) ? `${((_c = config.proxyServerCredentials) === null || _c === void 0 ? void 0 : _c.username) && ((_d = config.proxyServerCredentials) === null || _d === void 0 ? void 0 : _d.password) ? `${config.proxyServerCredentials.protocol ||
            config.proxyServerCredentials.address.includes('https') ? 'https' :
            config.proxyServerCredentials.address.includes('http') ? 'http' :
                config.proxyServerCredentials.address.includes('socks5') ? 'socks5' :
                    config.proxyServerCredentials.address.includes('socks4') ? 'socks4' : 'http'}://${config.proxyServerCredentials.username}:${config.proxyServerCredentials.password}@${config.proxyServerCredentials.address
            .replace('https', '')
            .replace('http', '')
            .replace('socks5', '')
            .replace('socks4', '')
            .replace('://', '')}` : config.proxyServerCredentials.address}` : false;
        let quickAuthed = false;
        let proxy;
        if (proxyAddr) {
            proxy = (yield Promise.resolve().then(() => __importStar(require('smashah-puppeteer-page-proxy')))).default;
        }
        /**
         * Detect a locally cached page
         */
        if (process.env.WA_LOCAL_PAGE_CACHE) {
            const localPageCacheExists = yield (0, tools_1.pathExists)(process.env.WA_LOCAL_PAGE_CACHE, true);
            logging_1.log.info(`Local page cache env var set: ${process.env.WA_LOCAL_PAGE_CACHE} ${localPageCacheExists}`);
            if (localPageCacheExists) {
                logging_1.log.info(`Local page cache file exists. Loading...`);
                pageCache = yield fs.readFile(process.env.WA_LOCAL_PAGE_CACHE, "utf8");
            }
        }
        if (interceptAuthentication || proxyAddr || blockCrashLogs || true) {
            yield waPage.setRequestInterception(true);
            waPage.on('response', (response) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (response.request().url() == "https://web.whatsapp.com/") {
                        const t = yield response.text();
                        if (t.includes(`class="no-js"`) && t.includes(`self.`) && !pageCache) {
                            //this is a valid response, save it for later
                            pageCache = t;
                            logging_1.log.info("saving valid page to dumb cache");
                            /**
                             * Save locally
                             */
                            if (process.env.WA_LOCAL_PAGE_CACHE) {
                                logging_1.log.info(`Writing page cache to local file: ${process.env.WA_LOCAL_PAGE_CACHE}`);
                                yield fs.writeFile(process.env.WA_LOCAL_PAGE_CACHE, pageCache);
                            }
                        }
                    }
                }
                catch (error) {
                    logging_1.log.error("page cache error", error);
                }
            }));
            const authCompleteEv = new events_1.EvEmitter(sessionId, 'AUTH');
            waPage.on('request', (request) => __awaiter(this, void 0, void 0, function* () {
                //local refresh cache:
                if (request.url() === "https://web.whatsapp.com/" && pageCache) {
                    //if the pageCache isn't set and this response includes 
                    logging_1.log.info("reviving page from page cache");
                    return yield request.respond({
                        status: 200,
                        body: pageCache
                    });
                }
                if (interceptAuthentication &&
                    request.url().includes('_priority_components') &&
                    !quickAuthed) {
                    authCompleteEv.emit(true);
                    yield waPage.evaluate('window.WA_AUTHENTICATED=true;');
                    quickAuthed = true;
                }
                if (request.url().includes('https://crashlogs.whatsapp.net/') && blockCrashLogs) {
                    request.abort();
                }
                else if (proxyAddr && !(config === null || config === void 0 ? void 0 : config.useNativeProxy)) {
                    proxy(request, proxyAddr);
                }
                else
                    request.continue();
            }));
        }
        if (skipAuth) {
            spinner.info("Skipping Authentication");
        }
        else {
            /**
             * AUTH
             */
            spinner === null || spinner === void 0 ? void 0 : spinner.info('Loading session data');
            let sessionjson = yield getSessionDataFromFile(sessionId, config, spinner);
            if (!sessionjson && sessionjson !== "" && config.sessionDataBucketAuth) {
                try {
                    spinner === null || spinner === void 0 ? void 0 : spinner.info('Unable to find session data file locally, attempting to find session data in cloud storage..');
                    sessionjson = JSON.parse(Buffer.from(yield (0, pico_s3_1.getTextFile)(Object.assign(Object.assign({ directory: '_sessionData' }, JSON.parse(Buffer.from(config.sessionDataBucketAuth, 'base64').toString('ascii'))), { filename: `${config.sessionId || 'session'}.data.json` })), 'base64').toString('ascii'));
                    spinner === null || spinner === void 0 ? void 0 : spinner.succeed('Successfully downloaded session data file from cloud storage!');
                }
                catch (error) {
                    spinner === null || spinner === void 0 ? void 0 : spinner.fail(`${error instanceof pico_s3_1.FileNotFoundError ? 'The session data file was not found in the cloud storage bucket' : 'Something went wrong while fetching session data from cloud storage bucket'}. Continuing...`);
                }
            }
            if (sessionjson && Object.keys(sessionjson).length) {
                spinner === null || spinner === void 0 ? void 0 : spinner.info(config.multiDevice ? "multi-device enabled. Session data skipped..." : 'Existing session data detected. Injecting...');
                if (!(config === null || config === void 0 ? void 0 : config.multiDevice))
                    yield waPage.evaluateOnNewDocument(session => {
                        localStorage.clear();
                        Object.keys(session).forEach(key => localStorage.setItem(key, session[key]));
                    }, sessionjson);
                spinner === null || spinner === void 0 ? void 0 : spinner.succeed('Existing session data injected');
            }
            else {
                if (config === null || config === void 0 ? void 0 : config.multiDevice) {
                    spinner === null || spinner === void 0 ? void 0 : spinner.info("No session data detected. Opting in for MD.");
                    spinner === null || spinner === void 0 ? void 0 : spinner.info("Make sure to keep the session alive for at least 5 minutes after scanning the QR code before trying to restart a session!!");
                    if (config === null || config === void 0 ? void 0 : config.legacy)
                        yield waPage.evaluateOnNewDocument(session => {
                            localStorage.clear();
                            Object.keys(session).forEach(key => localStorage.setItem(key, session[key]));
                        }, {
                            "md-opted-in": "true",
                            "MdUpgradeWamFlag": "true",
                            "remember-me": "true"
                        });
                }
            }
            /**
             * END AUTH
             */
        }
        if ((config === null || config === void 0 ? void 0 : config.proxyServerCredentials) && !(config === null || config === void 0 ? void 0 : config.useNativeProxy)) {
            yield proxy(waPage, proxyAddr);
        }
        if ((_e = config === null || config === void 0 ? void 0 : config.proxyServerCredentials) === null || _e === void 0 ? void 0 : _e.address)
            spinner.succeed(`Active proxy: ${config.proxyServerCredentials.address}`);
        yield Promise.all(setupPromises);
        spinner === null || spinner === void 0 ? void 0 : spinner.info(`Pre page launch setup complete: ${((0, tools_1.now)() - postBrowserLaunchTs).toFixed(0)}ms`);
        spinner === null || spinner === void 0 ? void 0 : spinner.info('Navigating to WA');
        try {
            //try twice 
            const WEB_START_TS = new Date().getTime();
            const webRes = yield waPage.goto(puppeteer_config_1.puppeteerConfig.WAUrl);
            const WEB_END_TS = new Date().getTime();
            yield waPage.exposeFunction("ProgressBarEvent", ({ value, text }) => {
                spinner === null || spinner === void 0 ? void 0 : spinner.info(`${(value || value === 0) && `${value}%:\t`} ${text}`);
                spinner === null || spinner === void 0 ? void 0 : spinner.emit({ value, text }, "internal_launch_progress");
            });
            yield (0, init_patch_1.injectProgObserver)(waPage);
            if (webRes == null) {
                spinner === null || spinner === void 0 ? void 0 : spinner.info(`Page loaded but something may have gone wrong: ${WEB_END_TS - WEB_START_TS}ms`);
            }
            else {
                spinner === null || spinner === void 0 ? void 0 : spinner.info(`Page loaded in ${WEB_END_TS - WEB_START_TS}ms: ${webRes.status()}${webRes.ok() ? '' : ', ' + webRes.statusText()}`);
                if (!webRes.ok())
                    spinner === null || spinner === void 0 ? void 0 : spinner.info(`Headers Info: ${JSON.stringify(webRes.headers(), null, 2)}`);
            }
        }
        catch (error) {
            spinner === null || spinner === void 0 ? void 0 : spinner.fail(error);
            throw error;
        }
        return waPage;
    });
}
exports.initPage = initPage;
const getSessionDataFromFile = (sessionId, config, spinner) => __awaiter(void 0, void 0, void 0, function* () {
    if ((config === null || config === void 0 ? void 0 : config.sessionData) == "NUKE")
        return '';
    //check if [session].json exists in __dirname
    const sessionjsonpath = yield (0, exports.getSessionDataFilePath)(sessionId, config);
    let sessionjson = '';
    const sd = process.env[`${sessionId.toUpperCase()}_DATA_JSON`] ? JSON.parse(process.env[`${sessionId.toUpperCase()}_DATA_JSON`]) : config === null || config === void 0 ? void 0 : config.sessionData;
    sessionjson = (typeof sd === 'string' && sd !== "") ? JSON.parse(Buffer.from(sd, 'base64').toString('ascii')) : sd;
    if (sessionjsonpath && typeof sessionjsonpath == 'string' && (yield (0, tools_1.pathExists)(sessionjsonpath))) {
        spinner.succeed(`Found session data file: ${sessionjsonpath}`);
        const s = yield fs.readFile(sessionjsonpath, "utf8");
        try {
            sessionjson = JSON.parse(s);
        }
        catch (error) {
            try {
                sessionjson = JSON.parse(Buffer.from(s, 'base64').toString('ascii'));
            }
            catch (error) {
                const msg = `${s == "LOGGED OUT" ? "The session was logged out" : "Session data json file is corrupted"}. Please re-scan the QR code.`;
                if (spinner) {
                    spinner.fail(msg);
                }
                else
                    console.error(msg);
                return false;
            }
        }
    }
    else {
        spinner.succeed(`No session data file found for session : ${sessionId}`);
    }
    return sessionjson;
});
const deleteSessionData = (config) => __awaiter(void 0, void 0, void 0, function* () {
    const sessionjsonpath = yield (0, exports.getSessionDataFilePath)((config === null || config === void 0 ? void 0 : config.sessionId) || 'session', config);
    if (typeof sessionjsonpath == 'string' && (yield (0, tools_1.pathExists)(sessionjsonpath))) {
        const l = `logout detected, deleting session data file: ${sessionjsonpath}`;
        console.log(l);
        logging_1.log.info(l);
        yield fs.unlink(sessionjsonpath);
    }
    const mdDir = yield (0, tools_1.pathExists)(config['userDataDir']);
    if (config['userDataDir'] && mdDir) {
        logging_1.log.info(`Deleting MD session directory: ${mdDir}`);
        yield fs.rm(mdDir, { force: true, recursive: true });
        logging_1.log.info(`MD directory ${mdDir} deleted: ${!(yield (0, tools_1.pathExists)(mdDir, true))}`);
    }
    return true;
});
exports.deleteSessionData = deleteSessionData;
const invalidateSesssionData = (config) => __awaiter(void 0, void 0, void 0, function* () {
    const sessionjsonpath = yield (0, exports.getSessionDataFilePath)((config === null || config === void 0 ? void 0 : config.sessionId) || 'session', config);
    if (typeof sessionjsonpath == 'string' && (yield (0, tools_1.pathExists)(sessionjsonpath))) {
        const l = `logout detected, invalidating session data file: ${sessionjsonpath}`;
        console.log(l);
        logging_1.log.info(l);
        fs.writeFile(sessionjsonpath, "LOGGED OUT");
    }
    return true;
});
exports.invalidateSesssionData = invalidateSesssionData;
const getSessionDataFilePath = (sessionId, config) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const p = ((_a = require === null || require === void 0 ? void 0 : require.main) === null || _a === void 0 ? void 0 : _a.path) || ((_b = process === null || process === void 0 ? void 0 : process.mainModule) === null || _b === void 0 ? void 0 : _b.path);
    const sessionjsonpath = ((config === null || config === void 0 ? void 0 : config.sessionDataPath) && (config === null || config === void 0 ? void 0 : config.sessionDataPath.includes('.data.json'))) ? path.join(path.resolve(process.cwd(), (config === null || config === void 0 ? void 0 : config.sessionDataPath) || '')) : path.join(path.resolve(process.cwd(), (config === null || config === void 0 ? void 0 : config.sessionDataPath) || ''), `${sessionId || 'session'}.data.json`);
    const altSessionJsonPath = p ? ((config === null || config === void 0 ? void 0 : config.sessionDataPath) && (config === null || config === void 0 ? void 0 : config.sessionDataPath.includes('.data.json'))) ? path.join(path.resolve(p, (config === null || config === void 0 ? void 0 : config.sessionDataPath) || '')) : path.join(path.resolve(p, (config === null || config === void 0 ? void 0 : config.sessionDataPath) || ''), `${sessionId || 'session'}.data.json`) : false;
    if ((0, tools_1.pathExists)(sessionjsonpath)) {
        return sessionjsonpath;
    }
    else if (p && altSessionJsonPath && (yield (0, tools_1.pathExists)(altSessionJsonPath))) {
        return altSessionJsonPath;
    }
    return false;
});
exports.getSessionDataFilePath = getSessionDataFilePath;
const addScript = (page, js) => __awaiter(void 0, void 0, void 0, function* () { return page.evaluate(yield script_preloader_1.scriptLoader.getScript(js)).catch(e => logging_1.log.error(`Injection error: ${js}`, e)); });
exports.addScript = addScript;
// (page: Page, js : string) : Promise<unknown> => page.addScriptTag({
//   path: require.resolve(path.join(__dirname, '../lib', js))
// })
function injectPreApiScripts(page, spinner) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield page.evaluate("!['jsSHA','axios', 'QRCode', 'Base64', 'objectHash'].find(x=>!window[x])"))
            return;
        const t1 = yield (0, tools_1.timePromise)(() => Promise.all([
            'jsSha.min.js',
            'qr.min.js',
            'base64.js',
            'hash.js'
        ].map(js => (0, exports.addScript)(page, js))));
        spinner === null || spinner === void 0 ? void 0 : spinner.info(`Base inject: ${t1}ms`);
        return page;
    });
}
exports.injectPreApiScripts = injectPreApiScripts;
function injectWapi(page, spinner, force = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const bruteInjectionAttempts = 1;
        yield (0, patch_manager_1.earlyInjectionCheck)(page);
        const check = `window.WAPI && window.Store ? true : false`;
        const initCheck = yield page.evaluate(check);
        if (initCheck)
            return;
        logging_1.log.info(`WAPI CHECK: ${initCheck}`);
        if (!initCheck)
            force = true;
        if (wapiInjected && !force)
            return page;
        const multiScriptInjectPromiseArr = Array(bruteInjectionAttempts).fill("wapi.js").map((_s) => (0, exports.addScript)(page, _s));
        try {
            const wapi = yield (0, tools_1.timePromise)(() => Promise.all(multiScriptInjectPromiseArr));
            spinner === null || spinner === void 0 ? void 0 : spinner.info(`WAPI inject: ${wapi}ms`);
        }
        catch (error) {
            logging_1.log.error("injectWapi ~ error", error.message);
            //one of the injection attempts failed.
            return yield injectWapi(page, spinner, force);
        }
        spinner === null || spinner === void 0 ? void 0 : spinner.info("Checking session integrity");
        wapiAttempts++;
        wapiInjected = !!(yield page.waitForFunction(check, { timeout: 3000, polling: 50 }).catch(e => false));
        if (!wapiInjected) {
            spinner === null || spinner === void 0 ? void 0 : spinner.info(`Session integrity check failed, trying again... ${wapiAttempts}`);
            return yield injectWapi(page, spinner, true);
        }
        spinner === null || spinner === void 0 ? void 0 : spinner.info("Session integrity check passed");
        return page;
    });
}
exports.injectWapi = injectWapi;
function injectApi(page, spinner, force = false) {
    return __awaiter(this, void 0, void 0, function* () {
        spinner === null || spinner === void 0 ? void 0 : spinner.info("Injecting scripts");
        yield injectPreApiScripts(page, spinner);
        yield injectWapi(page, spinner, force);
        const launch = yield (0, tools_1.timePromise)(() => (0, exports.addScript)(page, 'launch.js'));
        spinner === null || spinner === void 0 ? void 0 : spinner.succeed(`Launch inject: ${launch}ms`);
        return page;
    });
}
exports.injectApi = injectApi;
function initBrowser(sessionId, config = {}, spinner) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        if (config === null || config === void 0 ? void 0 : config.raspi) {
            config.executablePath = "/usr/bin/chromium-browser";
        }
        if ((config === null || config === void 0 ? void 0 : config.useChrome) && !(config === null || config === void 0 ? void 0 : config.executablePath)) {
            const { default: storage } = yield Promise.resolve().then(() => __importStar(require('node-persist')));
            yield storage.init();
            const _savedPath = yield storage.getItem('executablePath');
            if (!_savedPath) {
                const chromeLauncher = yield Promise.resolve().then(() => __importStar(require('chrome-launcher')));
                config.executablePath = chromeLauncher.Launcher.getInstallations()[0];
                if (!config.executablePath)
                    delete config.executablePath;
                yield storage.setItem('executablePath', config.executablePath);
            }
            else
                config.executablePath = _savedPath;
        }
        if (config === null || config === void 0 ? void 0 : config.browserRevision) {
            const browserFetcher = puppeteer.createBrowserFetcher();
            const browserDownloadSpinner = new events_1.Spin(sessionId + '_browser', 'Browser', false, false);
            try {
                browserDownloadSpinner.start('Downloading browser revision: ' + config.browserRevision);
                const revisionInfo = yield browserFetcher.download(config.browserRevision, function (downloadedBytes, totalBytes) {
                    browserDownloadSpinner.info(`Downloading Browser: ${Math.round(downloadedBytes / 1000000)}/${Math.round(totalBytes / 1000000)}`);
                });
                if (revisionInfo.executablePath) {
                    config.executablePath = revisionInfo.executablePath;
                    // config.pipe = true;
                }
                browserDownloadSpinner.succeed('Browser downloaded successfully');
            }
            catch (error) {
                browserDownloadSpinner.succeed('Something went wrong while downloading the browser');
            }
        }
        /**
         * Explicit fallback due to pptr 19
         */
        if (!config.executablePath)
            config.executablePath = (0, puppeteer_1.executablePath)();
        if (((_a = config === null || config === void 0 ? void 0 : config.proxyServerCredentials) === null || _a === void 0 ? void 0 : _a.address) && (config === null || config === void 0 ? void 0 : config.useNativeProxy))
            puppeteer_config_1.puppeteerConfig.chromiumArgs.push(`--proxy-server=${config.proxyServerCredentials.address}`);
        if (config === null || config === void 0 ? void 0 : config.browserWsEndpoint)
            config.browserWSEndpoint = config.browserWsEndpoint;
        let args = [...puppeteer_config_1.puppeteerConfig.chromiumArgs, ...((config === null || config === void 0 ? void 0 : config.chromiumArgs) || [])];
        if (config === null || config === void 0 ? void 0 : config.multiDevice) {
            args = args.filter(x => x != '--incognito');
            config["userDataDir"] = config["userDataDir"] || `${(config === null || config === void 0 ? void 0 : config.sessionDataPath) || ((config === null || config === void 0 ? void 0 : config.inDocker) ? '/sessions' : (config === null || config === void 0 ? void 0 : config.sessionDataPath) || '.')}/_IGNORE_${(config === null || config === void 0 ? void 0 : config.sessionId) || 'session'}`;
            spinner === null || spinner === void 0 ? void 0 : spinner.info('MD Enabled, turning off incognito mode.');
            spinner === null || spinner === void 0 ? void 0 : spinner.info(`Data dir: ${config["userDataDir"]}`);
        }
        if (config === null || config === void 0 ? void 0 : config.corsFix)
            args.push('--disable-web-security');
        if (config["userDataDir"] && !(yield (0, tools_1.pathExists)(config["userDataDir"]))) {
            spinner === null || spinner === void 0 ? void 0 : spinner.info(`Data dir doesnt exist, creating...: ${config["userDataDir"]}`);
            fs.mkdir(config["userDataDir"], { recursive: true });
        }
        const browser = (config === null || config === void 0 ? void 0 : config.browserWSEndpoint) ? yield puppeteer.connect(Object.assign({}, config)) : yield puppeteer.launch(Object.assign(Object.assign({ headless: true, args }, config), { devtools: false }));
        exports.BROWSER_START_TS = Date.now();
        //devtools
        if (config === null || config === void 0 ? void 0 : config.devtools) {
            const _dt = yield Promise.resolve().then(() => __importStar(require('puppeteer-extra-plugin-devtools')));
            const devtools = _dt.default();
            if (config.devtools !== 'local' && !((_b = config === null || config === void 0 ? void 0 : config.devtools) === null || _b === void 0 ? void 0 : _b.user) && !((_c = config === null || config === void 0 ? void 0 : config.devtools) === null || _c === void 0 ? void 0 : _c.pass)) {
                config.devtools = {};
                config.devtools.user = 'dev';
                const uuid = (yield Promise.resolve().then(() => __importStar(require('uuid-apikey')))).default;
                config.devtools.pass = uuid.create().apiKey;
            }
            if (config.devtools.user && config.devtools.pass) {
                devtools.setAuthCredentials(config.devtools.user, config.devtools.pass);
            }
            puppeteer.use(devtools);
            try {
                // const tunnel = await devtools.createTunnel(browser);
                const tunnel = config.devtools == 'local' ? devtools.getLocalDevToolsUrl(browser) : (yield devtools.createTunnel(browser)).url;
                const l = `\ndevtools URL: ${typeof config.devtools == 'object' ? JSON.stringify(Object.assign(Object.assign({}, config.devtools), { tunnel }), null, 2) : tunnel}`;
                spinner.info(l);
            }
            catch (error) {
                spinner.fail(error);
                logging_1.log.error("initBrowser -> error", error);
            }
        }
        return browser;
    });
}
function getWAPage(browser) {
    return __awaiter(this, void 0, void 0, function* () {
        const pages = yield browser.pages();
        console.assert(pages.length > 0);
        return pages[0];
    });
}
(0, death_1.default)(() => __awaiter(void 0, void 0, void 0, function* () {
    //clean up code here
    if (browser)
        yield (0, exports.kill)(browser);
}));
/**
 * @internal
 */
const kill = (p, b, exit, pid, reason = "LAUNCH_KILL") => __awaiter(void 0, void 0, void 0, function* () {
    (0, tools_1.processSendData)({
        reason
    });
    (0, tools_1.timeout)(3000);
    const killBrowser = (browser) => __awaiter(void 0, void 0, void 0, function* () {
        if (!browser)
            return;
        pid = (browser === null || browser === void 0 ? void 0 : browser.process()) ? browser === null || browser === void 0 ? void 0 : browser.process().pid : null;
        if (!pid)
            return;
        if (!(p === null || p === void 0 ? void 0 : p.isClosed()))
            yield (p === null || p === void 0 ? void 0 : p.close());
        if (browser)
            yield (browser === null || browser === void 0 ? void 0 : browser.close().catch(() => { }));
    });
    if (p) {
        const browser = (p === null || p === void 0 ? void 0 : p.browser) && typeof (p === null || p === void 0 ? void 0 : p.browser) === 'function' && (p === null || p === void 0 ? void 0 : p.browser());
        yield killBrowser(browser);
    }
    else if (b) {
        yield killBrowser(b);
    }
    if (pid)
        yield (0, promise_1.default)(pid, 'SIGKILL').catch(e => console.error('Error while terminating browser PID. You can just ignore this, as the process has most likely been terminated successfully already:', e.message));
    if (exit)
        process.exit();
    return;
});
exports.kill = kill;
