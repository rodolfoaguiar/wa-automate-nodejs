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
exports.create = exports.screenshot = exports.timeout = exports.configWithCases = exports.pkg = void 0;
const fs = __importStar(require("fs"));
const boxen_1 = __importDefault(require("boxen"));
const os_name_1 = __importDefault(require("os-name"));
const update_notifier_1 = __importDefault(require("update-notifier"));
const Client_1 = require("../api/Client");
const index_1 = require("../api/model/index");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const auth_1 = require("./auth");
const browser_1 = require("./browser");
const events_1 = require("./events");
const launch_checks_1 = require("./launch_checks");
const cfonts_1 = __importDefault(require("cfonts"));
const tools_1 = require("../utils/tools");
const crypto_1 = require("crypto");
const fs_extra_1 = require("fs-extra");
const pico_s3_1 = require("pico-s3");
const init_patch_1 = require("./init_patch");
const patch_manager_1 = require("./patch_manager");
const logging_1 = require("../logging/logging");
const timeout = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms, 'timeout'));
};
exports.pkg = (0, fs_extra_1.readJsonSync)(path.join(__dirname, '../../package.json')), exports.configWithCases = (0, fs_extra_1.readJsonSync)(path.join(__dirname, '../../bin/config-schema.json')), exports.timeout = timeout;
/**
 * Used to initialize the client session.
 *
 * *Note* It is required to set all config variables as [ConfigObject](https://open-wa.github.io/wa-automate-nodejs/interfaces/configobject.html) that includes both [sessionId](https://open-wa.github.io/wa-automate-nodejs/interfaces/configobject.html#sessionId). Setting the session id as the first variable is no longer valid
 *
 * e.g
 *
 * ```javascript
 * create({
 * sessionId: 'main',
 * customUserAgent: ' 'WhatsApp/2.16.352 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Safari/605.1.15',
 * blockCrashLogs true,
 * ...
 * })....
 * ```
 * @param config AdvancedConfig The extended custom configuration
 */
//@ts-ignore
function create(config = {}) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const START_TIME = Date.now();
        if (config.logging) {
            if (Array.isArray(config === null || config === void 0 ? void 0 : config.logging))
                config.logging = (0, logging_1.setupLogging)(config === null || config === void 0 ? void 0 : config.logging, `owa-${(config === null || config === void 0 ? void 0 : config.sessionId) || 'session'}`);
        }
        let waPage = undefined;
        let notifier;
        let sessionId = '';
        let customUserAgent;
        if (!config || (config === null || config === void 0 ? void 0 : config.eventMode) !== false) {
            config.eventMode = true;
        }
        if ((config === null || config === void 0 ? void 0 : config.waitForRipeSession) !== false)
            config.waitForRipeSession = true;
        if ((config === null || config === void 0 ? void 0 : config.multiDevice) !== false)
            config.multiDevice = true;
        if ((config === null || config === void 0 ? void 0 : config.deleteSessionDataOnLogout) !== false)
            config.deleteSessionDataOnLogout = true;
        if (!(config === null || config === void 0 ? void 0 : config.skipUpdateCheck) || (config === null || config === void 0 ? void 0 : config.keepUpdated)) {
            notifier = yield (0, update_notifier_1.default)({
                pkg: exports.pkg,
                updateCheckInterval: 0
            });
            notifier.notify();
            if ((notifier === null || notifier === void 0 ? void 0 : notifier.update) && (config === null || config === void 0 ? void 0 : config.keepUpdated) && (notifier === null || notifier === void 0 ? void 0 : notifier.update.latest) !== exports.pkg.version) {
                console.log('UPDATING @OPEN-WA');
                logging_1.log.info('UPDATING @OPEN-WA');
                const crossSpawn = yield Promise.resolve().then(() => __importStar(require('cross-spawn')));
                const result = crossSpawn.sync('npm', ['i', '@open-wa/wa-automate'], { stdio: 'inherit' });
                if (!result.stderr) {
                    console.log('UPDATED SUCCESSFULLY');
                    logging_1.log.info('UPDATED SUCCESSFULLY');
                }
                console.log('RESTARTING PROCESS');
                logging_1.log.info('RESTARTING PROCESS');
                process.on("exit", function () {
                    crossSpawn.spawn(process.argv.shift(), process.argv, {
                        cwd: process.cwd(),
                        detached: true,
                        stdio: "inherit"
                    });
                });
                process.exit();
            }
        }
        if (config === null || config === void 0 ? void 0 : config.inDocker) {
            //try to infer config variables from process.env
            config = Object.assign(Object.assign({}, config), (0, tools_1.getConfigFromProcessEnv)(exports.configWithCases));
            config.chromiumArgs = (config === null || config === void 0 ? void 0 : config.chromiumArgs) || [];
            customUserAgent = config.customUserAgent;
        }
        if (sessionId === '' || (config === null || config === void 0 ? void 0 : config.sessionId))
            sessionId = (config === null || config === void 0 ? void 0 : config.sessionId) || 'session';
        const prettyFont = cfonts_1.default.render(('@OPEN-WA|WHATSAPP|AUTOMATOR'), {
            font: '3d',
            color: 'candy',
            align: 'center',
            gradient: ["red", "#f80"],
            lineHeight: 3
        });
        console.log((config === null || config === void 0 ? void 0 : config.disableSpins) ? (0, boxen_1.default)([
            `@open-wa/wa-automate   `,
            `${exports.pkg.description}`,
            `Version: ${exports.pkg.version}   `,
            `Check out the latest changes: https://github.com/open-wa/wa-automate-nodejs#latest-changes   `,
        ].join('\n'), { padding: 1, borderColor: 'yellow', borderStyle: 'bold' }) : prettyFont.string);
        if (config === null || config === void 0 ? void 0 : config.popup) {
            const { popup } = yield Promise.resolve().then(() => __importStar(require('./popup')));
            const popupaddr = yield popup(config);
            console.log(`You can also authenticate the session at: ${popupaddr}`);
            logging_1.log.info(`You can also authenticate the session at: ${popupaddr}`);
        }
        if (!sessionId)
            sessionId = 'session';
        const spinner = new events_1.Spin(sessionId, 'STARTUP', config === null || config === void 0 ? void 0 : config.disableSpins);
        const qrManager = new auth_1.QRManager(config);
        const RAM_INFO = `Total: ${parseFloat(`${os.totalmem() / 1000000000}`).toFixed(2)} GB | Free: ${parseFloat(`${os.freemem() / 1000000000}`).toFixed(2)} GB`;
        logging_1.log.info("RAM INFO", RAM_INFO);
        const PPTR_VERSION = ((_a = (0, fs_extra_1.readJsonSync)(require.resolve("puppeteer/package.json"), { throws: false })) === null || _a === void 0 ? void 0 : _a.version) || "UNKNOWN";
        logging_1.log.info("PPTR VERSION INFO", PPTR_VERSION);
        try {
            if (typeof config === 'string')
                console.error("AS OF VERSION 3+ YOU CAN NO LONGER SET THE SESSION ID AS THE FIRST PARAMETER OF CREATE. CREATE CAN ONLY TAKE A CONFIG OBJECT. IF YOU STILL HAVE CONFIGS AS A SECOND PARAMETER, THEY WILL HAVE NO EFFECT! PLEASE SEE DOCS.");
            spinner.start('Starting');
            spinner.succeed(`Version: ${exports.pkg.version}`);
            spinner.info(`Initializing WA`);
            /**
             * Check if the IGNORE folder exists, therefore, assume that the session is MD.
             */
            const mdDir = config["userDataDir"] || `${(config === null || config === void 0 ? void 0 : config.sessionDataPath) || ((config === null || config === void 0 ? void 0 : config.inDocker) ? '/sessions' : (config === null || config === void 0 ? void 0 : config.sessionDataPath) || '.')}/_IGNORE_${(config === null || config === void 0 ? void 0 : config.sessionId) || 'session'}`;
            if (process.env.AUTO_MD && fs.existsSync(mdDir) && !(config === null || config === void 0 ? void 0 : config.multiDevice)) {
                spinner.info(`Multi-Device directory detected. multiDevice set to true.`);
                config.multiDevice = true;
            }
            if ((config === null || config === void 0 ? void 0 : config.multiDevice) && (config === null || config === void 0 ? void 0 : config.chromiumArgs))
                spinner.info(`Using custom chromium args with multi device will cause issues! Please remove them: ${config === null || config === void 0 ? void 0 : config.chromiumArgs}`);
            if ((config === null || config === void 0 ? void 0 : config.multiDevice) && !(config === null || config === void 0 ? void 0 : config.useChrome))
                spinner.info(`It is recommended to set useChrome: true or use the --use-chrome flag if you are experiencing issues with Multi device support`);
            waPage = yield (0, browser_1.initPage)(sessionId, config, qrManager, customUserAgent, spinner);
            spinner.succeed('Page loaded');
            const browserLaunchedTs = (0, tools_1.now)();
            const throwOnError = config && config.throwErrorOnTosBlock == true;
            const PAGE_UA = yield waPage.evaluate('navigator.userAgent');
            const BROWSER_VERSION = yield waPage.browser().version();
            const OS = (0, os_name_1.default)();
            const START_TS = Date.now();
            const screenshotPath = `./logs/${config.sessionId || 'session'}/${START_TS}`;
            exports.screenshot = (page) => __awaiter(this, void 0, void 0, function* () {
                yield page.screenshot({
                    path: `${screenshotPath}/${Date.now()}.jpg`
                }).catch(() => {
                    fs.mkdirSync(screenshotPath, { recursive: true });
                    return (0, exports.screenshot)(page);
                });
                console.log('Screenshot taken. path:', `${screenshotPath}`);
            });
            if (config === null || config === void 0 ? void 0 : config.screenshotOnInitializationBrowserError)
                waPage.on('console', (msg) => __awaiter(this, void 0, void 0, function* () {
                    for (let i = 0; i < msg.args().length; ++i)
                        console.log(`${i}: ${msg.args()[i]}`);
                    if (msg.type() === 'error' && !msg.text().includes('apify') && !msg.text().includes('crashlogs'))
                        yield (0, exports.screenshot)(waPage);
                }));
            const WA_AUTOMATE_VERSION = `${exports.pkg.version}${(notifier === null || notifier === void 0 ? void 0 : notifier.update) && ((notifier === null || notifier === void 0 ? void 0 : notifier.update.latest) !== exports.pkg.version) ? ` UPDATE AVAILABLE: ${notifier === null || notifier === void 0 ? void 0 : notifier.update.latest}` : ''}`;
            yield waPage.waitForFunction('window.Debug!=undefined && window.Debug.VERSION!=undefined');
            //@ts-ignore
            const WA_VERSION = yield waPage.evaluate(() => window.Debug ? window.Debug.VERSION : 'I think you have been TOS_BLOCKed');
            const canInjectEarly = yield (0, patch_manager_1.earlyInjectionCheck)(waPage);
            const attemptingReauth = yield waPage.evaluate(`!!(localStorage['WAToken2'] || localStorage['last-wid-md'])`);
            let debugInfo = {
                WA_VERSION,
                PAGE_UA,
                WA_AUTOMATE_VERSION,
                BROWSER_VERSION,
                OS,
                START_TS,
                RAM_INFO,
                PPTR_VERSION
            };
            if ((config === null || config === void 0 ? void 0 : config.logDebugInfoAsObject) || (config === null || config === void 0 ? void 0 : config.disableSpins))
                spinner.succeed(`Debug info: ${JSON.stringify(debugInfo, null, 2)}`);
            else {
                console.table(debugInfo);
                logging_1.log.info('Debug info:', debugInfo);
            }
            debugInfo.LATEST_VERSION = !((notifier === null || notifier === void 0 ? void 0 : notifier.update) && ((notifier === null || notifier === void 0 ? void 0 : notifier.update.latest) !== exports.pkg.version));
            debugInfo.CLI = process.env.OWA_CLI && true || false;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            spinner.succeed('Use this easy pre-filled link to report an issue: ' + (0, tools_1.generateGHIssueLink)(config, debugInfo));
            spinner.info(`Time to injection: ${((0, tools_1.now)() - browserLaunchedTs).toFixed(0)}ms`);
            if (canInjectEarly) {
                if (attemptingReauth)
                    yield waPage.evaluate(`window.Store = {"Msg": true}`);
                spinner.start('Injecting api');
                waPage = yield (0, browser_1.injectApi)(waPage, spinner);
                spinner.start('WAPI injected');
            }
            else {
                spinner.remove();
                if (throwOnError)
                    throw Error('TOSBLOCK');
            }
            spinner.start('Authenticating');
            const authRace = [];
            authRace.push((0, auth_1.isAuthenticated)(waPage).catch(() => { }));
            if ((config === null || config === void 0 ? void 0 : config.authTimeout) !== 0) {
                authRace.push((0, exports.timeout)((config.authTimeout || config.multiDevice ? 120 : 60) * 1000));
            }
            const authenticated = yield Promise.race(authRace);
            if (authenticated === 'NUKE' && !(config === null || config === void 0 ? void 0 : config.ignoreNuke)) {
                //kill the browser
                spinner.fail("Session data most likely expired due to manual host account logout. Please re-authenticate this session.");
                yield (0, browser_1.kill)(waPage);
                if (config === null || config === void 0 ? void 0 : config.deleteSessionDataOnLogout)
                    yield (0, browser_1.deleteSessionData)(config);
                if (config === null || config === void 0 ? void 0 : config.throwOnExpiredSessionData) {
                    throw new index_1.SessionExpiredError();
                }
                else
                    //restart the process with no session data
                    return create(Object.assign(Object.assign({}, config), { sessionData: authenticated }));
            }
            /**
             * Attempt to preload the license
             */
            const earlyWid = yield waPage.evaluate(`(localStorage["last-wid"] || '').replace(/"/g,"")`);
            const licensePromise = (0, patch_manager_1.getLicense)(config, {
                _serialized: earlyWid
            }, debugInfo, spinner);
            if (authenticated == 'timeout') {
                const oorProms = [(0, auth_1.phoneIsOutOfReach)(waPage)];
                if ((config === null || config === void 0 ? void 0 : config.oorTimeout) !== 0)
                    oorProms.push((0, exports.timeout)(((config === null || config === void 0 ? void 0 : config.oorTimeout) || 60) * 1000));
                const outOfReach = yield Promise.race(oorProms);
                spinner.emit(outOfReach && outOfReach !== 'timeout' ? 'appOffline' : 'authTimeout');
                spinner.fail(outOfReach && outOfReach !== 'timeout' ? 'Authentication timed out. Please open the app on the phone. Shutting down' : 'Authentication timed out. Shutting down. Consider increasing authTimeout config variable: https://open-wa.github.io/wa-automate-nodejs/interfaces/configobject.html#authtimeout');
                yield (0, browser_1.kill)(waPage);
                if (config === null || config === void 0 ? void 0 : config.killProcessOnTimeout)
                    process.exit();
                throw new Error(outOfReach ? 'App Offline' : 'Auth Timeout. Consider increasing authTimeout config variable: https://open-wa.github.io/wa-automate-nodejs/interfaces/configobject.html#authtimeout');
            }
            if (authenticated) {
                spinner.succeed('Authenticated');
            }
            else {
                spinner.info('Authenticate to continue');
                const race = [];
                race.push(qrManager.smartQr(waPage, config, spinner));
                if ((config === null || config === void 0 ? void 0 : config.qrTimeout) !== 0) {
                    let to = ((config === null || config === void 0 ? void 0 : config.qrTimeout) || 60) * 1000;
                    if (config === null || config === void 0 ? void 0 : config.multiDevice)
                        to = to * 2;
                    race.push((0, exports.timeout)(to));
                }
                const result = yield Promise.race(race);
                if (result === "MULTI_DEVICE_DETECTED" && !(config === null || config === void 0 ? void 0 : config.multiDevice)) {
                    yield (0, browser_1.kill)(waPage);
                    return create(Object.assign(Object.assign({}, config), { multiDevice: true }));
                }
                if (result == 'timeout') {
                    spinner.emit('qrTimeout');
                    spinner.fail('QR scan took too long. Session Timed Out. Shutting down. Consider increasing qrTimeout config variable: https://open-wa.github.io/wa-automate-nodejs/interfaces/configobject.html#qrtimeout');
                    yield (0, browser_1.kill)(waPage);
                    if (config === null || config === void 0 ? void 0 : config.killProcessOnTimeout)
                        process.exit();
                    throw new Error('QR Timeout');
                }
                spinner.emit('successfulScan');
                spinner.succeed();
            }
            if (attemptingReauth) {
                yield waPage.evaluate("window.Store = undefined");
                if (config === null || config === void 0 ? void 0 : config.waitForRipeSession) {
                    spinner.start("Waiting for ripe session...");
                    if (yield (0, auth_1.waitForRipeSession)(waPage))
                        spinner.succeed("Session ready for injection");
                    else
                        spinner.fail("You may experience issues in headless mode. Continuing...");
                }
            }
            const pre = canInjectEarly ? 'Rei' : 'I';
            spinner.start(`${pre}njecting api`);
            waPage = yield (0, browser_1.injectApi)(waPage, spinner, true);
            spinner.succeed(`WAPI ${pre}njected`);
            if (canInjectEarly) {
                //check if page is valid after 5 seconds
                spinner.start('Checking if session is valid');
                if (config === null || config === void 0 ? void 0 : config.safeMode)
                    yield (0, exports.timeout)(5000);
            }
            //@ts-ignore
            const VALID_SESSION = yield waPage.waitForFunction(`window.Store && window.Store.Msg ? true : false`, { timeout: 9000, polling: 200 }).catch((e) => __awaiter(this, void 0, void 0, function* () {
                logging_1.log.error("Valid session check failed", e);
                return false;
            }));
            if (VALID_SESSION) {
                /**
                 * Session is valid, attempt to preload patches
                 */
                const patchPromise = (0, patch_manager_1.getPatch)(config, spinner, debugInfo);
                spinner.succeed('Client is ready');
                const localStorage = JSON.parse(yield waPage.evaluate(() => {
                    return JSON.stringify(window.localStorage);
                }));
                const stdSessionJsonPath = ((config === null || config === void 0 ? void 0 : config.sessionDataPath) && (config === null || config === void 0 ? void 0 : config.sessionDataPath.includes('.data.json'))) ? path.join(path.resolve(process.cwd(), (config === null || config === void 0 ? void 0 : config.sessionDataPath) || '')) : path.join(path.resolve(process.cwd(), (config === null || config === void 0 ? void 0 : config.sessionDataPath) || ''), `${sessionId || 'session'}.data.json`);
                const altMainModulePath = ((_b = require === null || require === void 0 ? void 0 : require.main) === null || _b === void 0 ? void 0 : _b.path) || ((_c = process === null || process === void 0 ? void 0 : process.mainModule) === null || _c === void 0 ? void 0 : _c.path);
                const altSessionJsonPath = !altMainModulePath ? null : ((config === null || config === void 0 ? void 0 : config.sessionDataPath) && (config === null || config === void 0 ? void 0 : config.sessionDataPath.includes('.data.json'))) ? path.join(path.resolve(altMainModulePath, (config === null || config === void 0 ? void 0 : config.sessionDataPath) || '')) : path.join(path.resolve(altMainModulePath, (config === null || config === void 0 ? void 0 : config.sessionDataPath) || ''), `${sessionId || 'session'}.data.json`);
                const sessionjsonpath = altSessionJsonPath && fs.existsSync(altSessionJsonPath) ? altSessionJsonPath : stdSessionJsonPath;
                const sessionData = {
                    WABrowserId: localStorage.WABrowserId,
                    WASecretBundle: localStorage.WASecretBundle,
                    WAToken1: localStorage.WAToken1,
                    WAToken2: localStorage.WAToken2
                };
                if (config.multiDevice) {
                    delete sessionData.WABrowserId;
                    logging_1.log.info("Multi-device detected. Removing Browser ID from session data to prevent session reauth corruption");
                }
                const sdB64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
                spinner.emit(sessionData, "sessionData");
                spinner.emit(sdB64, "sessionDataBase64");
                if (!(config === null || config === void 0 ? void 0 : config.skipSessionSave))
                    fs.writeFile(sessionjsonpath, sdB64, (err) => {
                        if (err) {
                            console.error(err);
                            return;
                        }
                    });
                if (config === null || config === void 0 ? void 0 : config.sessionDataBucketAuth) {
                    try {
                        spinner === null || spinner === void 0 ? void 0 : spinner.info('Uploading new session data to cloud storage..');
                        yield (0, pico_s3_1.upload)(Object.assign(Object.assign({ directory: '_sessionData' }, JSON.parse(Buffer.from(config.sessionDataBucketAuth, 'base64').toString('ascii'))), { filename: `${config.sessionId || 'session'}.data.json`, file: `data:text/plain;base64,${Buffer.from(sdB64).toString('base64')}` }));
                        spinner === null || spinner === void 0 ? void 0 : spinner.succeed('Successfully uploaded session data file to cloud storage!');
                    }
                    catch (error) {
                        spinner === null || spinner === void 0 ? void 0 : spinner.fail(`Something went wrong while uploading new session data to cloud storage bucket. Continuing...`);
                    }
                }
                /**
                 * Set page-level logging
                 */
                waPage.on('console', msg => {
                    if (config === null || config === void 0 ? void 0 : config.logConsole)
                        console.log(msg);
                    logging_1.log.info('Page Console:', msg.text());
                });
                waPage.on('error', error => {
                    if (config === null || config === void 0 ? void 0 : config.logConsoleErrors)
                        console.error(error);
                    logging_1.log.error('Page Console Error:', error.message || (error === null || error === void 0 ? void 0 : error.text()));
                });
                if (config === null || config === void 0 ? void 0 : config.restartOnCrash)
                    waPage.on('error', (error) => __awaiter(this, void 0, void 0, function* () {
                        console.error('Page Crashed! Restarting...', error);
                        yield (0, browser_1.kill)(waPage);
                        yield create(config).then(config.restartOnCrash);
                    }));
                const pureWAPI = yield (0, launch_checks_1.checkWAPIHash)();
                if (!pureWAPI) {
                    config.skipBrokenMethodsCheck = true;
                    // config.skipPatches = true;
                }
                if (config === null || config === void 0 ? void 0 : config.hostNotificationLang) {
                    yield waPage.evaluate(`window.hostlang="${config.hostNotificationLang}"`);
                }
                //patch issues with wapi.js
                if (!(config === null || config === void 0 ? void 0 : config.skipPatches)) {
                    yield (0, patch_manager_1.getAndInjectLivePatch)(waPage, spinner, yield patchPromise, config, debugInfo);
                    debugInfo.OW_KEY = yield waPage.evaluate(`window.o()`);
                }
                const NUM = ((yield waPage.evaluate(`(window.moi() || "").replace('@c.us','').replace(/"/g,"")`)) || "");
                debugInfo.NUM = NUM.slice(-4);
                debugInfo.NUM_HASH = (0, crypto_1.createHash)('md5').update(NUM, 'utf8').digest('hex');
                if ((config === null || config === void 0 ? void 0 : config.skipBrokenMethodsCheck) !== true)
                    yield (0, launch_checks_1.integrityCheck)(waPage, notifier, spinner, debugInfo);
                const LAUNCH_TIME_MS = Date.now() - START_TIME;
                debugInfo = Object.assign(Object.assign({}, debugInfo), { LAUNCH_TIME_MS });
                spinner.emit(debugInfo, "DebugInfo");
                //@ts-ignore
                const metrics = yield waPage.evaluate(({ config }) => WAPI.launchMetrics(config), { config });
                const purgedMessage = (metrics === null || metrics === void 0 ? void 0 : metrics.purged) ? Object.entries(metrics.purged).filter(([, e]) => e > 0).map(([k, e]) => `${e} ${k}`).join(" and ") : "";
                if (metrics.isMd && !(config === null || config === void 0 ? void 0 : config.multiDevice))
                    spinner.info("!!!Please set multiDevice: true in the config or use the --mutli-Device flag!!!");
                spinner.succeed(`Client loaded for ${metrics.isBiz ? "business" : "normal"} account ${metrics.isMd && "[MD] " || ''}with ${metrics.contacts} contacts, ${metrics.chats} chats & ${metrics.messages} messages ${purgedMessage ? `+ purged ${purgedMessage} ` : ``}in ${LAUNCH_TIME_MS / 1000}s`);
                debugInfo.ACC_TYPE = metrics.isBiz ? "BUSINESS" : "PERSONAL";
                if ((config === null || config === void 0 ? void 0 : config.deleteSessionDataOnLogout) || (config === null || config === void 0 ? void 0 : config.killClientOnLogout))
                    config.eventMode = true;
                const client = new Client_1.Client(waPage, config, Object.assign(Object.assign({}, debugInfo), metrics));
                const { me } = yield client.getMe();
                const licIndex = process.argv.findIndex(arg => arg === "--license-key" || arg === "-l");
                config.licenseKey = config.licenseKey || licIndex !== -1 && process.argv[licIndex + 1];
                if ((config === null || config === void 0 ? void 0 : config.licenseKey) || me._serialized !== earlyWid) {
                    yield (0, patch_manager_1.getAndInjectLicense)(waPage, config, me, debugInfo, spinner, me._serialized !== earlyWid ? false : yield licensePromise);
                }
                spinner.info("Finalizing web session...");
                yield (0, init_patch_1.injectInitPatch)(waPage);
                spinner.info("Finalizing client...");
                yield client.loaded();
                if (config.ensureHeadfulIntegrity && !attemptingReauth) {
                    spinner.info("QR scanned for the first time. Refreshing...");
                    yield client.refresh();
                    spinner.info("Session refreshed.");
                }
                const issueLink = yield client.getIssueLink();
                console.log((0, boxen_1.default)("Use the link below to easily report issues:👇👇👇", { padding: 1, borderColor: 'red' }));
                spinner.succeed(issueLink);
                spinner.succeed(`🚀 @OPEN-WA ready for account: ${me.user.slice(-4)}`);
                if (!debugInfo.CLI && !config.licenseKey)
                    spinner.succeed(`Use this link to get a license: ${yield client.getLicenseLink()}`);
                spinner.emit('SUCCESS');
                spinner.remove();
                return client;
            }
            else {
                const storeKeys = yield waPage.evaluate(`Object.keys(window.Store || {})`);
                logging_1.log.info("Store keys", storeKeys);
                spinner.fail('The session is invalid. Retrying');
                yield (0, browser_1.kill)(waPage);
                return yield create(config);
            }
        }
        catch (error) {
            spinner.emit(error.message);
            logging_1.log.error(error.message);
            if (error.stack) {
                logging_1.log.error(error.stack);
                console.error(error.stack);
            }
            yield (0, browser_1.kill)(waPage);
            if (error.name === "ProtocolError" && ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("Target closed"))) {
                spinner.fail(error.message);
                process.exit();
            }
            if (error.name === "TimeoutError" && (config === null || config === void 0 ? void 0 : config.multiDevice)) {
                spinner.fail(`Please delete the ${config === null || config === void 0 ? void 0 : config.userDataDir} folder and any related data.json files and try again. It is highly suggested to set useChrome: true also.`);
            }
            if (error.name === "TimeoutError" && (config === null || config === void 0 ? void 0 : config.killProcessOnTimeout)) {
                process.exit();
            }
            else {
                spinner.remove();
                throw error;
            }
        }
    });
}
exports.create = create;
