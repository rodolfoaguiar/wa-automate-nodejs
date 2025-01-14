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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useragent = exports.Client = exports.namespace = void 0;
const mime_types_1 = __importDefault(require("mime-types"));
const axios_1 = __importDefault(require("axios"));
const puppeteer_config_1 = require("../config/puppeteer.config");
const model_1 = require("./model");
const errors_1 = require("./model/errors");
const p_queue_1 = __importDefault(require("p-queue"));
const events_1 = require("../controllers/events");
const uuid_1 = require("uuid");
const parse_function_1 = __importDefault(require("parse-function"));
const fs = __importStar(require("fs"));
const datauri_1 = __importDefault(require("datauri"));
const is_url_superb_1 = __importDefault(require("is-url-superb"));
const fs_extra_1 = require("fs-extra");
const browser_1 = require("../controllers/browser");
const auth_1 = require("../controllers/auth");
const wa_decrypt_1 = require("@open-wa/wa-decrypt");
const path = __importStar(require("path"));
const media_1 = require("./model/media");
const patch_manager_1 = require("../controllers/patch_manager");
const events_2 = require("./model/events");
const MessageCollector_1 = require("../structures/MessageCollector");
const init_patch_1 = require("../controllers/init_patch");
const preProcessors_1 = require("../structures/preProcessors");
const tools_1 = require("../utils/tools");
const logging_1 = require("../logging/logging");
const pid_utils_1 = require("../utils/pid_utils");
/** @ignore */
const pkg = (0, fs_extra_1.readJsonSync)(path.join(__dirname, '../../package.json'));
var namespace;
(function (namespace) {
    namespace["Chat"] = "Chat";
    namespace["Msg"] = "Msg";
    namespace["Contact"] = "Contact";
    namespace["GroupMetadata"] = "GroupMetadata";
})(namespace = exports.namespace || (exports.namespace = {}));
/* eslint-enable */
class Client {
    /**
     * @ignore
     * @param page [Page] [Puppeteer Page]{@link https://pptr.dev/#?product=Puppeteer&version=v2.1.1&show=api-class-page} running WA Web
     */
    constructor(page, createConfig, sessionInfo) {
        this._currentlyBeingKilled = false;
        this._refreshing = false;
        this._loaded = false;
        this._prio = Number.MAX_SAFE_INTEGER;
        this._pageListeners = [];
        this._registeredPageListeners = [];
        this._onLogoutCallbacks = [];
        this._queues = {};
        this._autoEmojiSet = false;
        this._autoEmojiQ = new p_queue_1.default({
            concurrency: 1,
            intervalCap: 1,
            carryoverConcurrencyCount: true
        });
        this._onLogoutSet = false;
        this._preprocIdempotencyCheck = {};
        /**
         * This is used to track if a listener is already used via webhook. Before, webhooks used to be set once per listener. Now a listener can be set via multiple webhooks, or revoked from a specific webhook.
         * For this reason, listeners assigned to a webhook are only set once and map through all possible webhooks to and fire only if the specific listener is assigned.
         *
         * Note: This would be much simpler if eventMode was the default (and only) listener strategy.
         */
        this._registeredWebhookListeners = {};
        /**
         * This exposes a simple express middlware that will allow users to quickly boot up an api based off this client. Checkout demo/index.ts for an example
         * How to use the middleware:
         *
         * ```javascript
         *
         * import { create } from '@open-wa/wa-automate';
         * const express = require('express')
         * const app = express()
         * app.use(express.json())
         * const PORT = 8082;
         *
         * function start(client){
         *   app.use(client.middleware()); //or client.middleware(true) if you require the session id to be part of the path (so localhost:8082/sendText beccomes localhost:8082/sessionId/sendText)
         *   app.listen(PORT, function () {
         *     console.log(`\n• Listening on port ${PORT}!`);
         *   });
         *   ...
         * }
         *
         *
         * create({
         *   sessionId:'session1'
         * }).then(start)
         *
         * ```
         *
         * All requests need to be `POST` requests. You use the API the same way you would with `client`. The method can be the path or the method param in the post body. The arguments for the method should be properly ordered in the args array in the JSON post body.
         *
         * Example:
         *
         * ```javascript
         *   await client.sendText('4477777777777@c.us','test')
         *   //returns "true_4477777777777@c.us_3EB0645E623D91006252"
         * ```
         * as a request with a path:
         *
         * ```javascript
         * const axios = require('axios').default;
         * axios.post('localhost:8082/sendText', {
         *     args: [
         *        "4477777777777@c.us",
         *        "test"
         *         ]
         *   })
         * ```
         *
         * or as a request without a path:
         *
         * ```javascript
         * const axios = require('axios').default;
         * axios.post('localhost:8082', {
         *     method:'sendText',
         *     args: [
         *        "4477777777777@c.us",
         *        "test"
         *         ]
         * })
         * ```
         *
         * As of 1.9.69, you can also send the argyments as an object with the keys mirroring the paramater names of the relative client functions
         *
         * Example:
         *
         * ```javascript
         * const axios = require('axios').default;
         * axios.post('localhost:8082', {
         *     method:'sendText',
         *     args: {
         *        "to":"4477777777777@c.us",
         *        "content":"test"
         *         }
         * })
         * ```
         * @param useSessionIdInPath boolean Set this to true if you want to keep each session in it's own path.
         *
         * For example, if you have a session with id  `host` if you set useSessionIdInPath to true, then all requests will need to be prefixed with the path `host`. E.g `localhost:8082/sendText` becomes `localhost:8082/host/sendText`
         */
        this.middleware = (useSessionIdInPath = false, PORT) => (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            if (useSessionIdInPath && !req.path.includes(this._createConfig.sessionId) && this._createConfig.sessionId !== 'session')
                return next();
            const methodFromPath = this._createConfig.sessionId && this._createConfig.sessionId !== 'session' && req.path.includes(this._createConfig.sessionId) ? req.path.replace(`/${this._createConfig.sessionId}/`, '') : req.path.replace('/', '');
            if (req.get('owa-check-property') && req.get('owa-check-value')) {
                const checkProp = req.get('owa-check-property');
                const checkValue = req.get('owa-check-value');
                const sessionId = this._createConfig.sessionId;
                const hostAccountNumber = yield this.getHostNumber();
                let checkPassed = false;
                switch (checkProp) {
                    case 'session':
                        checkPassed = sessionId === checkValue;
                        break;
                    case 'number':
                        checkPassed = hostAccountNumber.includes(checkValue);
                        break;
                }
                if (!checkPassed) {
                    if (PORT)
                        (0, tools_1.processSendData)({ port: PORT });
                    return res.status(412).send({
                        success: false,
                        error: {
                            name: 'CHECK_FAILED',
                            message: `Check FAILED - Are you sure you meant to send the request to this session?`,
                            data: {
                                incomingCheckProperty: checkProp,
                                incomingCheckValue: checkValue,
                                sessionId,
                                hostAccountNumber: `${hostAccountNumber.substr(-4)}`
                            }
                        }
                    });
                }
            }
            if (req.method === 'POST') {
                const rb = (req === null || req === void 0 ? void 0 : req.body) || {};
                let { args } = rb;
                const m = (rb === null || rb === void 0 ? void 0 : rb.method) || methodFromPath;
                logging_1.log.info(`MDLWR - ${m} : ${JSON.stringify(rb || {})}`);
                let methodRequiresArgs = false;
                if (args && !Array.isArray(args)) {
                    const methodArgs = (0, parse_function_1.default)().parse(this[m]).args;
                    logging_1.log.info(`methodArgs: ${methodArgs}`);
                    if ((methodArgs === null || methodArgs === void 0 ? void 0 : methodArgs.length) > 0)
                        methodRequiresArgs = true;
                    args = methodArgs.map(argName => args[argName]);
                }
                else if (!args)
                    args = [];
                if (this[m]) {
                    try {
                        const response = yield this[m](...args);
                        let success = true;
                        if (typeof response == 'string' && (response.startsWith("Error") || response.startsWith("ERROR")))
                            success = false;
                        return res.send({
                            success,
                            response
                        });
                    }
                    catch (error) {
                        console.error("middleware -> error", error);
                        if (methodRequiresArgs && Array.isArray(args))
                            error.message = `${(req === null || req === void 0 ? void 0 : req.params) ? "Please set arguments in request json body, not in params." : "Args expected, none found."} ${error.message}`;
                        return res.send({
                            success: false,
                            error: {
                                name: error.name,
                                message: error.message,
                                data: error.data
                            }
                        });
                    }
                }
                return res.status(404).send(`Cannot find method: ${m}`);
            }
            if (req.method === "GET") {
                if (["snapshot", "getSnapshot"].includes(methodFromPath)) {
                    const snapshot = yield this.getSnapshot();
                    const snapshotBuffer = Buffer.from(snapshot.split(',')[1], 'base64');
                    res.writeHead(200, {
                        'Content-Type': 'image/png',
                        'Content-Length': snapshotBuffer.length
                    });
                    return res.end(snapshotBuffer);
                }
            }
            return next();
        });
        this._page = page;
        this._createConfig = createConfig || {};
        this._loadedModules = [];
        this._sessionInfo = sessionInfo;
        this._sessionInfo.INSTANCE_ID = (0, uuid_1.v4)();
        this._listeners = {};
        if (this._createConfig.stickerServerEndpoint !== false)
            this._createConfig.stickerServerEndpoint = true;
        this._setOnClose();
    }
    /**
     * @private
     *
     * DO NOT USE THIS.
     *
     * Run all tasks to set up client AFTER init is fully completed
     */
    loaded() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return __awaiter(this, void 0, void 0, function* () {
            if ((_a = this._createConfig) === null || _a === void 0 ? void 0 : _a.eventMode) {
                yield this.registerAllSimpleListenersOnEv();
            }
            this._sessionInfo.PHONE_VERSION = (_c = (_b = (yield this.getMe())) === null || _b === void 0 ? void 0 : _b.phone) === null || _c === void 0 ? void 0 : _c.wa_version;
            logging_1.log.info('LOADED', {
                PHONE_VERSION: this._sessionInfo.PHONE_VERSION
            });
            if ((((_d = this._createConfig) === null || _d === void 0 ? void 0 : _d.autoEmoji) === undefined || ((_e = this._createConfig) === null || _e === void 0 ? void 0 : _e.autoEmoji)) && !this._autoEmojiSet) {
                const ident = typeof ((_f = this._createConfig) === null || _f === void 0 ? void 0 : _f.autoEmoji) === "string" ? (_g = this._createConfig) === null || _g === void 0 ? void 0 : _g.autoEmoji : ":";
                this.onMessage((message) => __awaiter(this, void 0, void 0, function* () {
                    if ((message === null || message === void 0 ? void 0 : message.body) && message.body.startsWith(ident) && message.body.endsWith(ident)) {
                        const emojiId = message.body.replace(new RegExp(ident, 'g'), "");
                        if (!emojiId)
                            return;
                        yield this._autoEmojiQ.add(() => __awaiter(this, void 0, void 0, function* () { return this.sendEmoji(message.from, emojiId, message.id).catch(() => { }); }));
                    }
                }));
                this._autoEmojiSet = true;
            }
            if ((((_h = this._createConfig) === null || _h === void 0 ? void 0 : _h.deleteSessionDataOnLogout) || ((_j = this._createConfig) === null || _j === void 0 ? void 0 : _j.killClientOnLogout)) && !this._onLogoutSet) {
                this.onLogout(() => __awaiter(this, void 0, void 0, function* () {
                    var _k, _l, _o, _q, _r, _s;
                    yield this.waitAllQEmpty();
                    yield ((_l = (_k = this._queues) === null || _k === void 0 ? void 0 : _k.onLogout) === null || _l === void 0 ? void 0 : _l.onEmpty());
                    yield ((_q = (_o = this._queues) === null || _o === void 0 ? void 0 : _o.onLogout) === null || _q === void 0 ? void 0 : _q.onIdle());
                    yield (0, browser_1.invalidateSesssionData)(this._createConfig);
                    if ((_r = this._createConfig) === null || _r === void 0 ? void 0 : _r.deleteSessionDataOnLogout)
                        yield (0, browser_1.deleteSessionData)(this._createConfig);
                    if ((_s = this._createConfig) === null || _s === void 0 ? void 0 : _s.killClientOnLogout) {
                        console.log("Session logged out. Killing client");
                        logging_1.log.warn("Session logged out. Killing client");
                        this.kill("LOGGED_OUT");
                    }
                }), -1);
                this._onLogoutSet = true;
            }
            this._loaded = true;
        });
    }
    registerAllSimpleListenersOnEv() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(Object.keys(events_2.SimpleListener).map(eventKey => this.registerEv(events_2.SimpleListener[eventKey])));
        });
    }
    getSessionId() {
        return this._createConfig.sessionId || 'session';
    }
    getPage() {
        return this._page;
    }
    _setOnClose() {
        this._page.on('close', () => {
            var _a;
            if (!this._refreshing) {
                console.log("Browser page has closed. Killing client");
                logging_1.log.warn("Browser page has closed. Killing client");
                this.kill("PAGE_CLOSED");
                if ((_a = this._createConfig) === null || _a === void 0 ? void 0 : _a.killProcessOnBrowserClose)
                    process.exit();
            }
        });
    }
    _reInjectWapi(newTab) {
        return __awaiter(this, void 0, void 0, function* () {
            yield (0, browser_1.injectApi)(newTab || this._page, null, true);
        });
    }
    _reRegisterListeners() {
        return __awaiter(this, void 0, void 0, function* () {
            return Object.keys(this._listeners).forEach((listenerName) => this[listenerName](this._listeners[listenerName]));
        });
    }
    /**
     * A convinience method to download the [[DataURL]] of a file
     * @param url The url
     * @param optionsOverride You can use this to override the [axios request config](https://github.com/axios/axios#request-config)
     * @returns `Promise<DataURL>`
     */
    download(url, optionsOverride = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, tools_1.getDUrl)(url, optionsOverride);
        });
    }
    /**
     * Grab the logger for this session/process
     */
    logger() {
        return logging_1.log;
    }
    /**
     * Refreshes the page and reinjects all necessary files. This may be useful for when trying to save memory
     * This will attempt to re register all listeners EXCEPT onLiveLocation and onParticipantChanged
     */
    refresh() {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            this._refreshing = true;
            const spinner = new events_1.Spin(((_a = this._createConfig) === null || _a === void 0 ? void 0 : _a.sessionId) || 'session', 'REFRESH', (_b = this._createConfig) === null || _b === void 0 ? void 0 : _b.disableSpins);
            const { me } = yield this.getMe();
            /**
             * preload license
             */
            const preloadlicense = ((_c = this._createConfig) === null || _c === void 0 ? void 0 : _c.licenseKey) ? yield (0, patch_manager_1.getLicense)(this._createConfig, me, this._sessionInfo, spinner) : false;
            spinner.info('Refreshing session');
            const START_TIME = Date.now();
            spinner.info("Opening session in new tab");
            const newTab = yield this._page.browser().newPage();
            const qrManager = new auth_1.QRManager(this._createConfig);
            yield (0, browser_1.initPage)(this.getSessionId(), this._createConfig, qrManager, this._createConfig.customUserAgent, spinner, newTab, true);
            //  await newTab.goto(puppeteerConfig.WAUrl);
            //Two promises. One that closes the previous page, one that sets up the new page
            const closePageOnConflict = () => __awaiter(this, void 0, void 0, function* () {
                const useHere = yield this._page.evaluate(() => WAPI.getUseHereString());
                spinner.info("Waiting for conflict to close stale tab...");
                yield this._page.waitForFunction(`[...document.querySelectorAll("div[role=button")].find(e=>{return e.innerHTML.toLowerCase().includes("${useHere.toLowerCase()}")})`, { timeout: 0, polling: 500 });
                yield this._page.goto('about:blank');
                spinner.info("Closing stale tab");
                yield this._page.close();
                spinner.info("Stale tab closed. Switching contexts...");
                this._page = newTab;
            });
            const setupNewPage = () => __awaiter(this, void 0, void 0, function* () {
                var _e, _f;
                /**
                 * Wait for the new page to be loaded up before closing existing page
                 */
                spinner.info("Checking if fresh session is authenticated...");
                if (yield (0, auth_1.isAuthenticated)(newTab)) {
                    /**
                     * Reset all listeners
                     */
                    this._registeredEvListeners = {};
                    // this._listeners = {};
                    if ((_e = this._createConfig) === null || _e === void 0 ? void 0 : _e.waitForRipeSession) {
                        yield this._reInjectWapi(newTab);
                        spinner.start("Waiting for ripe session...");
                        if (yield (0, auth_1.waitForRipeSession)(newTab))
                            spinner.succeed("Session ready for injection");
                        else
                            spinner.fail("You may experience issues in headless mode. Continuing...");
                    }
                    spinner.info("Injected new session...");
                    yield this._reInjectWapi(newTab);
                    /**
                     * patch
                     */
                    yield (0, patch_manager_1.getAndInjectLivePatch)(newTab, spinner, null, this._createConfig, this._sessionInfo);
                    if ((_f = this._createConfig) === null || _f === void 0 ? void 0 : _f.licenseKey)
                        yield (0, patch_manager_1.getAndInjectLicense)(newTab, this._createConfig, me, this._sessionInfo, spinner, preloadlicense);
                    /**
                     * init patch
                     */
                    yield (0, init_patch_1.injectInitPatch)(newTab);
                }
                else
                    throw new Error("Session Logged Out. Cannot refresh. Please restart the process and scan the qr code.");
            });
            yield Promise.all([
                closePageOnConflict(),
                setupNewPage()
            ]);
            spinner.info("New session live. Setting up...");
            spinner.info("Reregistering listeners");
            yield this.loaded();
            if (!((_d = this._createConfig) === null || _d === void 0 ? void 0 : _d.eventMode))
                yield this._reRegisterListeners();
            spinner.succeed(`Session refreshed in ${(Date.now() - START_TIME) / 1000}s`);
            this._refreshing = false;
            spinner.remove();
            this._setOnClose();
            return true;
        });
    }
    /**
     * Get the session info
     *
     * @returns SessionInfo
     */
    getSessionInfo() {
        return this._sessionInfo;
    }
    /**
     * Easily resize page on the fly. Useful if you're showing screenshots in a web-app.
     */
    resizePage(width = 1920, height = 1080) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._page.setViewport({
                width,
                height
            });
            return true;
        });
    }
    /**
     * Get the config which was used to set up the client. Sensitive details (like devTools username and password, and browserWSEndpoint) are scrubbed
     *
     * @returns SessionInfo
     */
    getConfig() {
        /* eslint-disable */
        const _a = this._createConfig, { devtools, browserWSEndpoint, sessionData, proxyServerCredentials, restartOnCrash } = _a, rest = __rest(_a, ["devtools", "browserWSEndpoint", "sessionData", "proxyServerCredentials", "restartOnCrash"]);
        /* eslint-enable */
        return rest;
    }
    pup(pageFunction, ...args) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function* () {
            const invocation_id = (0, uuid_1.v4)().slice(-5);
            const { safeMode, callTimeout, idCorrection, logging } = this._createConfig;
            let _t;
            if (safeMode) {
                if (!this._page || this._page.isClosed())
                    throw new errors_1.CustomError(errors_1.ERROR_NAME.PAGE_CLOSED, 'page closed');
                const state = yield this.forceUpdateConnectionState();
                if (state !== model_1.STATE.CONNECTED)
                    throw new errors_1.CustomError(errors_1.ERROR_NAME.STATE_ERROR, `state: ${state}`);
            }
            if (idCorrection && args[0]) {
                const fixId = (id) => {
                    var _a;
                    let isGroup = false;
                    let scrubbedId = (_a = id === null || id === void 0 ? void 0 : id.match(/\d|-/g)) === null || _a === void 0 ? void 0 : _a.join('');
                    scrubbedId = scrubbedId.match(/-/g) && scrubbedId.match(/-/g).length == 1 && scrubbedId.split('-')[1].length === 10 ? scrubbedId : scrubbedId.replace(/-/g, '');
                    if (scrubbedId.includes('-') || scrubbedId.length === 18)
                        isGroup = true;
                    const fixed = isGroup ?
                        `${scrubbedId === null || scrubbedId === void 0 ? void 0 : scrubbedId.replace(/@(c|g).us/g, '')}@g.us` :
                        `${scrubbedId === null || scrubbedId === void 0 ? void 0 : scrubbedId.replace(/@(c|g).us/g, '')}@c.us`;
                    logging_1.log.info('Fixed ID', { id, fixed });
                    return fixed;
                };
                if (typeof args[0] === 'string' && args[0] && !(args[0].includes("@g.us") || args[0].includes("@c.us")) && ((_c = (_b = (((_a = pageFunction === null || pageFunction === void 0 ? void 0 : pageFunction.toString()) === null || _a === void 0 ? void 0 : _a.match(/[^(]*\(([^)]*)\)/)[1]) || "")) === null || _b === void 0 ? void 0 : _b.replace(/\s/g, '')) === null || _c === void 0 ? void 0 : _c.split(','))) {
                    const p = ((pageFunction === null || pageFunction === void 0 ? void 0 : pageFunction.toString().match(/[^(]*\(([^)]*)\)/)[1]) || "").replace(/\s/g, '').split(',');
                    if (["to", "chatId", "groupChatId", "groupId", "contactId"].includes(p[0]))
                        args[0] = fixId(args[0]);
                }
                else if (typeof args[0] === 'object')
                    Object.entries(args[0]).map(([k, v]) => {
                        if (["to", "chatId", "groupChatId", "groupId", "contactId"].includes(k) && typeof v == "string" && v && !(v.includes("@g.us") || v.includes("@c.us"))) {
                            args[0][k] = fixId(v);
                        }
                    });
            }
            if (logging) {
                const wapis = (_e = (((_d = pageFunction === null || pageFunction === void 0 ? void 0 : pageFunction.toString()) === null || _d === void 0 ? void 0 : _d.match(/WAPI\.(\w*)\(/g)) || [])) === null || _e === void 0 ? void 0 : _e.map(s => s.replace(/WAPI|\.|\(/g, ''));
                _t = Date.now();
                const _args = ["string", "number", "boolean"].includes(typeof args[0]) ? args[0] : Object.assign({}, args[0]);
                logging_1.log.info(`IN ${invocation_id}`, {
                    _method: (wapis === null || wapis === void 0 ? void 0 : wapis.length) === 1 ? wapis[0] : wapis,
                    _args
                });
            }
            if ((_f = this._createConfig) === null || _f === void 0 ? void 0 : _f.aggressiveGarbageCollection) {
                const gc = yield this._page.evaluate(() => gc());
            }
            const mainPromise = this._page.evaluate(pageFunction, ...args);
            if (callTimeout)
                return yield Promise.race([mainPromise, new Promise((resolve, reject) => { var _a; return setTimeout(reject, (_a = this._createConfig) === null || _a === void 0 ? void 0 : _a.callTimeout, new errors_1.PageEvaluationTimeout()); })]);
            const res = yield mainPromise;
            if (_t && logging) {
                logging_1.log.info(`OUT ${invocation_id}: ${Date.now() - _t}ms`, { res });
            }
            return this.responseWrap(res);
        });
    }
    responseWrap(res) {
        if (this._loaded && typeof res === "string" && res.includes("requires") && res.includes("license")) {
            console.info('\x1b[36m', "🔶", res, "🔶", '\x1b[0m');
        }
        if (this._createConfig.onError && typeof res == "string" && (res.startsWith("Error") || res.startsWith("ERROR"))) {
            const e = this._createConfig.onError;
            /**
             * Log error
             */
            if (e == model_1.OnError.LOG_AND_FALSE ||
                e == model_1.OnError.LOG_AND_STRING ||
                res.includes("get.openwa.dev"))
                console.error(res);
            /**
             * Return res
             */
            if (e == model_1.OnError.AS_STRING ||
                e == model_1.OnError.NOTHING ||
                e == model_1.OnError.LOG_AND_STRING)
                return res;
            /**
             * Return false
             */
            if (e == model_1.OnError.LOG_AND_FALSE ||
                e == model_1.OnError.RETURN_FALSE)
                return false;
            if (e == model_1.OnError.RETURN_ERROR)
                return new Error(res);
            if (e == model_1.OnError.THROW)
                throw new Error(res);
        }
        return res;
    }
    /**
     * ////////////////////////  LISTENERS
     */
    removeListener(listener) {
        events_1.ev.removeAllListeners(this.getEventSignature(listener));
        return true;
    }
    removeAllListeners() {
        Object.keys(this._registeredEvListeners).map(listener => events_1.ev.removeAllListeners(this.getEventSignature(listener)));
        return true;
    }
    /**
     *
     */
    registerListener(funcName, _fn, queueOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            let fn;
            if (queueOptions) {
                if (!this._queues[funcName]) {
                    this._queues[funcName] = new p_queue_1.default(queueOptions);
                }
                fn = (data) => __awaiter(this, void 0, void 0, function* () {
                    return this._queues[funcName].add(() => _fn(data), {
                        priority: this.tickPriority()
                    });
                });
            }
            else {
                fn = _fn;
            }
            if (this._registeredEvListeners && this._registeredEvListeners[funcName]) {
                return events_1.ev.on(this.getEventSignature(funcName), ({ data }) => fn(data), { objectify: true });
            }
            /**
             * If evMode is on then make the callback come from ev.
             */
            //add a reference to this callback
            const set = () => this.pup(({ funcName }) => {
                //@ts-ignore
                return window[funcName] ? WAPI[`${funcName}`](obj => window[funcName](obj)) : false;
            }, { funcName });
            if (this._listeners[funcName] && !this._refreshing) {
                return true;
            }
            this._listeners[funcName] = fn;
            const exists = yield this.pup(({ funcName }) => window[funcName] ? true : false, { funcName });
            if (exists)
                return yield set();
            const res = yield this._page.exposeFunction(funcName, (obj) => fn(obj)).then(set).catch(() => set);
            return res;
        });
    }
    // NON-STANDARD LISTENERS
    registerPageEventListener(_event, callback, priority) {
        const event = _event;
        this._pageListeners.push({
            event,
            callback,
            priority
        });
        if (this._registeredPageListeners.includes(event))
            return true;
        this._registeredPageListeners.push(event);
        logging_1.log.info(`setting page listener: ${event}`, this._registeredPageListeners);
        this._page.on(event, (...args) => __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(this._pageListeners.filter(l => l.event === event).filter(({ priority }) => priority !== -1).sort((a, b) => (b.priority || 0) - (a.priority || 0)).map(l => l.callback(...args)));
            yield Promise.all(this._pageListeners.filter(l => l.event === event).filter(({ priority }) => priority == -1).sort((a, b) => (b.priority || 0) - (a.priority || 0)).map(l => l.callback(...args)));
            return;
        }));
    }
    /**
     * It calls the JavaScript garbage collector
     * @returns Nothing.
     */
    gc() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._page.evaluate(() => gc());
            return;
        });
    }
    /**
     * Listens to a log out event
     *
     * @event
     * @param fn callback
     * @param priority A priority of -1 will mean the callback will be triggered after all the non -1 callbacks
     * @fires `true`
     */
    onLogout(fn, priority) {
        return __awaiter(this, void 0, void 0, function* () {
            const event = 'framenavigated';
            this._onLogoutCallbacks.push({
                callback: fn,
                priority
            });
            if (!this._queues[event])
                this._queues[event] = new p_queue_1.default({
                    concurrency: 1,
                    intervalCap: 1,
                    carryoverConcurrencyCount: true
                });
            if (this._registeredPageListeners.includes(event))
                return true;
            this.registerPageEventListener(event, (frame) => __awaiter(this, void 0, void 0, function* () {
                if (frame.url().includes('post_logout=1')) {
                    console.log("LOGGED OUT");
                    logging_1.log.warn("LOGGED OUT");
                    yield Promise.all(this._onLogoutCallbacks.filter(c => c.priority !== -1).map(({ callback }) => this._queues[event].add(() => callback(true))));
                    yield this._queues[event].onEmpty();
                    yield Promise.all(this._onLogoutCallbacks.filter(c => c.priority == -1).map(({ callback }) => this._queues[event].add(() => callback(true))));
                    yield this._queues[event].onEmpty();
                }
            }), priority || 1);
            return true;
        });
    }
    /**
     * Wait for the webhook queue to become idle. This is useful for ensuring webhooks are cleared before ending a process.
     */
    waitWhQIdle() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._webhookQueue) {
                return yield this._webhookQueue.onIdle();
            }
            return true;
        });
    }
    /**
     * Wait for all queues to be empty
     */
    waitAllQEmpty() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Promise.all([
                this._webhookQueue,
                ...Object.values(this._queues)
            ].filter(q => q).map(q => q === null || q === void 0 ? void 0 : q.onEmpty()));
            return true;
        });
    }
    /**
     * If you have set `onAnyMessage` or `onMessage` with the second parameter (PQueue options) then you may want to inspect their respective PQueue's.
     */
    getListenerQueues() {
        return this._queues;
    }
    // STANDARD SIMPLE LISTENERS
    preprocessMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._preprocIdempotencyCheck[message.id]) {
                logging_1.log.info(`preprocessMessage: ${message.id} already being processed`);
                return message;
            }
            this._preprocIdempotencyCheck[message.id] = true;
            let fil = "";
            try {
                fil = typeof this._createConfig.preprocFilter == "function" ? this._createConfig.preprocFilter : typeof this._createConfig.preprocFilter == "string" ? eval(this._createConfig.preprocFilter || "undefined") : undefined;
            }
            catch (error) {
                //do nothing
            }
            const m = fil ? [message].filter(typeof fil == "function" ? fil : x => x)[0] : message;
            if (m && this._createConfig.messagePreprocessor) {
                if (!Array.isArray(this._createConfig.messagePreprocessor))
                    this._createConfig.messagePreprocessor = [this._createConfig.messagePreprocessor];
                /**
                 * Map/chain over the preprocs and resolve.
                 *
                 * Each promise will update the _m value which is just a mutatable message object.
                 */
                let _m = m;
                yield Promise.all(this._createConfig.messagePreprocessor.map((preproc, index) => __awaiter(this, void 0, void 0, function* () {
                    let custom = false;
                    const start = Date.now();
                    if (typeof preproc === "function") {
                        custom = true;
                        _m = yield preproc(_m, this);
                    }
                    else if (typeof preproc === "string" && preProcessors_1.MessagePreprocessors[preproc])
                        _m = yield preProcessors_1.MessagePreprocessors[preproc](_m, this);
                    logging_1.log.info(`Preproc ${custom ? 'CUSTOM' : preproc} ${index} ${fil} ${message.id} ${m.id} ${Date.now() - start}ms`);
                    return _m;
                })));
                const preprocres = _m || message;
                delete this._preprocIdempotencyCheck[message.id];
                return preprocres;
            }
            delete this._preprocIdempotencyCheck[message.id];
            return message;
        });
    }
    /**
     * Listens to incoming messages
     *
     * @event
     * @param fn callback
     * @param queueOptions PQueue options. Set to `{}` for default PQueue.
     * @fires [[Message]]
     */
    onMessage(fn, queueOptions) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const _fn = (message) => __awaiter(this, void 0, void 0, function* () { return fn(yield this.preprocessMessage(message)); });
            return this.registerListener(events_2.SimpleListener.Message, _fn, ((_a = this === null || this === void 0 ? void 0 : this._createConfig) === null || _a === void 0 ? void 0 : _a.pQueueDefault) || queueOptions);
        });
    }
    /**
    * Listens to all new messages
    *
    * @event
    * @param fn callback
    * @param queueOptions PQueue options. Set to `{}` for default PQueue.
    * @fires [[Message]]
    */
    onAnyMessage(fn, queueOptions) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const _fn = (message) => __awaiter(this, void 0, void 0, function* () { return fn(yield this.preprocessMessage(message)); });
            return this.registerListener(events_2.SimpleListener.AnyMessage, _fn, ((_a = this === null || this === void 0 ? void 0 : this._createConfig) === null || _a === void 0 ? void 0 : _a.pQueueDefault) || queueOptions);
        });
    }
    /**
     *
     * Listens to when a message is deleted by a recipient or the host account
     * @event
     * @param fn callback
     * @fires [[Message]]
     */
    onMessageDeleted(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.MessageDeleted, fn);
        });
    }
    /**
     * Listens to when a chat is deleted by the host account
     * @event
     * @param fn callback
     * @fires [[Chat]]
     */
    onChatDeleted(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.ChatDeleted, fn);
        });
    }
    /**
     * Listens to button message responses
     * @event
     * @param fn callback
     * @fires [[Message]]
     */
    onButton(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.Button, fn);
        });
    }
    /**
     * Listens to poll vote events
     * @event
     * @param fn callback
     * @fires [[PollData]]
     */
    onPollVote(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.PollVote, fn);
        });
    }
    /**
     * Listens to broadcast messages
     * @event
     * @param fn callback
     * @fires [[Message]]
     */
    onBroadcast(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.Broadcast, fn);
        });
    }
    /**
     * @deprecated
     *
     * Listens to battery changes
     *
     * :::caution
     *
     *  This will most likely not work with multi-device mode (the only remaining mode) since the session is no longer connected to the phone but directly to WA servers.
     *
     * :::
     *
     * @event
     * @param fn callback
     * @fires number
     */
    onBattery(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.Battery, fn);
        });
    }
    /**
     * Listens to when host device is plugged/unplugged
     * @event
     *
     * @param fn callback
     * @fires boolean true if plugged, false if unplugged
     */
    onPlugged(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.Plugged, fn);
        });
    }
    /**
     * {@license:restricted@}
     *
     * Listens to when a contact posts a new story.
     * @event
     *
     * @param fn callback
     * @fires e.g
     *
     * ```javascript
     * {
     * from: '123456789@c.us'
     * id: 'false_132234234234234@status.broadcast'
     * }
     * ```
     */
    onStory(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.Story, fn);
        });
    }
    /**
     * Listens to changes in state
     *
     * @event
     * @fires STATE observable sream of states
     */
    onStateChanged(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.StateChanged, fn);
        });
    }
    /**
     * Listens to new incoming calls
     * @event
     * @returns Observable stream of call request objects
     */
    onIncomingCall(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.IncomingCall, fn);
        });
    }
    /**
     * Listens to changes on call state
     * @event
     * @returns Observable stream of call objects
     */
    onCallState(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.CallState, fn);
        });
    }
    /**
     * Listens to label change events
     *
     * @event
     * @param fn callback
     * @fires [[Label]]
     */
    onLabel(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.Label, fn);
        });
    }
    /**
     *{@license:insiders@}
     *
     * Listens to new orders. Only works on business accounts
     */
    onOrder(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.Order, fn);
        });
    }
    /**
     *{@license:insiders@}
     *
     * Listens to new orders. Only works on business accounts
     */
    onNewProduct(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.NewProduct, fn);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Listens to reaction add and change events
     *
     * @event
     * @param fn callback
     * @fires [[ReactionEvent]]
     */
    onReaction(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.Reaction, fn);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Listens to chat state, including when a specific user is recording and typing within a group chat.
     *
     * @event
     *
     * Here is an example of the fired object:
     *
     * @fires
     * ```javascript
     * {
     * "chat": "00000000000-1111111111@g.us", //the chat in which this state is occuring
     * "user": "22222222222@c.us", //the user that is causing this state
     * "state": "composing, //can also be 'available', 'unavailable', 'recording' or 'composing'
     * }
     * ```
     */
    onChatState(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.ChatState, fn);
        });
    }
    /**
     * Listens to messages acknowledgement Changes
     *
     * @param fn callback function that handles a [[Message]] as the first and only parameter.
     * @event
     * @returns `true` if the callback was registered
     */
    onAck(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            const _fn = (message) => __awaiter(this, void 0, void 0, function* () { return fn(message); });
            return this.registerListener(events_2.SimpleListener.Ack, _fn);
        });
    }
    /**
     * Listens to add and remove events on Groups on a global level. It is memory efficient and doesn't require a specific group id to listen to.
     *
     * @event
     * @param fn callback function that handles a [[ParticipantChangedEventModel]] as the first and only parameter.
     * @returns `true` if the callback was registered
     */
    onGlobalParticipantsChanged(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.GlobalParticipantsChanged, fn);
        });
    }
    /**
     * Listens to all group (gp2) events. This can be useful if you want to catch when a group title, subject or picture is changed.
     *
     * @event
     * @param fn callback function that handles a [[ParticipantChangedEventModel]] as the first and only parameter.
     * @returns `true` if the callback was registered
     */
    onGroupChange(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.GroupChange, fn);
        });
    }
    /**
     * Fires callback with Chat object every time the host phone is added to a group.
     *
     * @event
     * @param fn callback function that handles a [[Chat]] (group chat) as the first and only parameter.
     * @returns `true` if the callback was registered
     */
    onAddedToGroup(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.AddedToGroup, fn);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Fires callback with Chat object every time the host phone is removed to a group.
     *
     * @event
     * @param fn callback function that handles a [[Chat]] (group chat) as the first and only parameter.
     * @returns `true` if the callback was registered
     */
    onRemovedFromGroup(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.RemovedFromGroup, fn);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Fires callback with the relevant chat id every time the user clicks on a chat. This will only work in headful mode.
     *
     * @event
     * @param fn callback function that handles a [[ChatId]] as the first and only parameter.
     * @returns `true` if the callback was registered
     */
    onChatOpened(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.ChatOpened, fn);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Fires callback with contact id when a new contact is added on the host phone.
     *
     * @event
     * @param fn callback function that handles a [[Chat]] as the first and only parameter.
     * @returns `true` if the callback was registered
     */
    onContactAdded(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.registerListener(events_2.SimpleListener.ChatOpened, fn);
        });
    }
    // COMPLEX LISTENERS
    /**
     * @event
     * Listens to add and remove events on Groups. This can no longer determine who commited the action and only reports the following events add, remove, promote, demote
     * @param groupId group id: xxxxx-yyyy@c.us
     * @param fn callback
     * @returns Observable stream of participantChangedEvent
     */
    onParticipantsChanged(groupId, fn, legacy = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const funcName = "onParticipantsChanged_" + groupId.replace('_', "").replace('_', "");
            return this._page.exposeFunction(funcName, (participantChangedEvent) => fn(participantChangedEvent))
                .then(() => this.pup(({ groupId, funcName, legacy }) => {
                //@ts-ignore
                if (legacy)
                    return WAPI._onParticipantsChanged(groupId, window[funcName]);
                else
                    return WAPI.onParticipantsChanged(groupId, window[funcName]);
            }, { groupId, funcName, legacy }));
        });
    }
    /**
     * @event Listens to live locations from a chat that already has valid live locations
     * @param chatId the chat from which you want to subscribes to live location updates
     * @param fn callback that takes in a LiveLocationChangedEvent
     * @returns boolean, if returns false then there were no valid live locations in the chat of chatId
     * @emits `<LiveLocationChangedEvent>` LiveLocationChangedEvent
     */
    onLiveLocation(chatId, fn) {
        return __awaiter(this, void 0, void 0, function* () {
            const funcName = "onLiveLocation_" + chatId.replace('_', "").replace('_', "");
            return this._page.exposeFunction(funcName, (liveLocationChangedEvent) => fn(liveLocationChangedEvent))
                .then(() => this.pup(({ chatId, funcName }) => {
                //@ts-ignore
                return WAPI.onLiveLocation(chatId, window[funcName]);
            }, { chatId, funcName }));
        });
    }
    /**
     * Use this simple command to test firing callback events.
     *
     * @param callbackToTest
     * @param testData
     * @returns `false` if the callback was not registered/does not exist
     */
    testCallback(callbackToTest, testData) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.pup(({ callbackToTest, testData }) => {
                return WAPI.testCallback(callbackToTest, testData);
            }, { callbackToTest, testData });
        });
    }
    /**
     * Set presence to available or unavailable.
     * @param available if true it will set your presence to 'online', false will set to unavailable (i.e no 'online' on recipients' phone);
     */
    setPresence(available) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(available => WAPI.setPresence(available), available);
        });
    }
    /**
     * set your about me
     * @param newStatus String new profile status
     */
    setMyStatus(newStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ newStatus }) => WAPI.setMyStatus(newStatus), { newStatus });
        });
    }
    /**
     * {@license:insiders@}
     *
     * Adds label from chat, message or contact. Only for business accounts.
     * @param label: The desired text of the new label. id will be something simple like anhy nnumber from 1-10, name is the label of the label if that makes sense.
     * @returns `false` if something went wrong, or the id (usually a number as a string) of the new label (for example `"58"`)
     */
    createLabel(label) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ label }) => WAPI.createLabel(label), { label });
        });
    }
    /**
     * Adds label from chat, message or contact. Only for business accounts.
     * @param label: either the id or the name of the label. id will be something simple like anhy nnumber from 1-10, name is the label of the label if that makes sense.
     * @param id The Chat, message or contact id to which you want to add a label
     */
    addLabel(label, chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ label, chatId }) => WAPI.addOrRemoveLabels(label, chatId, 'add'), { label, chatId });
        });
    }
    /**
     * Returns all labels and the corresponding tagged items.
     */
    getAllLabels() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getAllLabels());
        });
    }
    /**
     * Removes label from chat, message or contact. Only for business accounts.
     * @param label: either the id or the name of the label. id will be something simple like anhy nnumber from 1-10, name is the label of the label if that makes sense.
     * @param id The Chat, message or contact id to which you want to add a label
     */
    removeLabel(label, chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ label, chatId }) => WAPI.addOrRemoveLabels(label, chatId, 'remove'), { label, chatId });
        });
    }
    /**
     * Get an array of chats that match the label parameter. For example, if you want to get an array of chat objects that have the label "New customer".
     *
     * This method is case insenstive and only works on business host accounts.
     *
     * @label The label name
     */
    getChatsByLabel(label) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.pup(({ label }) => WAPI.getChatsByLabel(label), { label });
            if (typeof res == 'string')
                new errors_1.CustomError(errors_1.ERROR_NAME.INVALID_LABEL, res);
            return res;
        });
    }
    /**
     * Send VCARD
     *
     * @param {string} chatId '000000000000@c.us'
     * @param {string} vcard vcard as a string, you can send multiple contacts vcard also.
     * @param {string} contactName The display name for the contact. Ignored on multiple vcards
     * @param {string} contactNumber If supplied, this will be injected into the vcard (VERSION 3 ONLY FROM VCARDJS) with the WA id to make it show up with the correct buttons on WA. The format of this param should be including country code, without any other formating. e.g:
     * `4477777777777`
     *  Ignored on multiple vcards
     */
    sendVCard(chatId, vcard, contactName, contactNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId, vcard, contactName, contactNumber }) => WAPI.sendVCard(chatId, vcard, contactName, contactNumber), { chatId, vcard, contactName, contactNumber });
        });
    }
    /**
     * Set your profile name
     *
     * Please note, this does not work on business accounts!
     *
     * @param newName String new name to set for your profile
     */
    setMyName(newName) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ newName }) => WAPI.setMyName(newName), { newName });
        });
    }
    /**
     * Sets the chat state
     * @param {ChatState|0|1|2} chatState The state you want to set for the chat. Can be TYPING (0), RECRDING (1) or PAUSED (2).
     * @param {String} chatId
     */
    setChatState(chatState, chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatState, chatId }) => WAPI.setChatState(chatState, chatId), 
            //@ts-ignore
            { chatState, chatId });
        });
    }
    /**
     * Returns the connection state
     */
    getConnectionState() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._page.evaluate(() => WAPI.getState());
        });
    }
    /**
     * Retreive an array of messages that are not yet sent to the recipient via the host account device (i.e no ticks)
     */
    getUnsentMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._page.evaluate(() => WAPI.getUnsentMessages());
        });
    }
    /**
     * Forces the session to update the connection state. This will take a few seconds to determine the 'correct' state.
     * @returns updated connection state
     */
    forceUpdateConnectionState() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._page.evaluate(() => WAPI.forceUpdateConnectionState());
        });
    }
    /**
     * Returns a list of contact with whom the host number has an existing chat who are also not contacts.
     */
    getChatWithNonContacts() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._page.evaluate(() => WAPI.getChatWithNonContacts());
        });
    }
    /**
     * Shuts down the page and browser
     * @returns true
     */
    kill(reason = "MANUALLY_KILLED") {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (this._currentlyBeingKilled)
                return;
            this._currentlyBeingKilled = true;
            console.log(`Killing client. Shutting Down: ${reason}`);
            logging_1.log.info(`Killing client. Shutting Down: ${reason}`);
            const browser = yield ((_a = this === null || this === void 0 ? void 0 : this._page) === null || _a === void 0 ? void 0 : _a.browser());
            const pid = (browser === null || browser === void 0 ? void 0 : browser.process()) ? (_b = browser === null || browser === void 0 ? void 0 : browser.process()) === null || _b === void 0 ? void 0 : _b.pid : null;
            try {
                yield (0, browser_1.kill)(this._page, browser, false, pid, reason);
            }
            catch (error) {
                //ignore error
            }
            this._currentlyBeingKilled = false;
            return true;
        });
    }
    /**
     * This is a convinient method to click the `Use Here` button in the WA web session.
     *
     * Use this when [[STATE]] is `CONFLICT`. You can read more about managing state here:
     *
     * [[Detecting Logouts]]
     */
    forceRefocus() {
        return __awaiter(this, void 0, void 0, function* () {
            const useHere = yield this._page.evaluate(() => WAPI.getUseHereString());
            yield this._page.waitForFunction(`[...document.querySelectorAll("div[role=button")].find(e=>{return e.innerHTML.toLowerCase().includes("${useHere.toLowerCase()}")})`, { timeout: 0 });
            yield this._page.evaluate(`[...document.querySelectorAll("div[role=button")].find(e=>{return e.innerHTML.toLowerCase().includes("${useHere.toLowerCase()}")}).click()`);
            return true;
        });
    }
    /**
     * Check if the "Phone not Cconnected" message is showing in the browser. If it is showing, then this will return `true`.
     *
     * @returns `boolean`
     */
    isPhoneDisconnected() {
        return __awaiter(this, void 0, void 0, function* () {
            const phoneNotConnected = yield this._page.evaluate(() => WAPI.getLocaledString('active Internet connection'));
            //@ts-ignore
            return yield this.pup(`!![...document.querySelectorAll("div")].find(e=>{return e.innerHTML.toLowerCase().includes("${phoneNotConnected.toLowerCase()}")})`);
        });
    }
    /**
     * Runs a health check to help you determine if/when is an appropiate time to restart/refresh the session.
     */
    healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._page.evaluate(() => WAPI.healthCheck());
        });
    }
    /**
     * Get the stats of the current process and the corresponding browser process.
     */
    getProcessStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, pid_utils_1.pidTreeUsage)([process.pid, this._page.browser().process().pid]);
        });
    }
    /**
     * A list of participants in the chat who have their live location on. If the chat does not exist, or the chat does not have any contacts actively sharing their live locations, it will return false. If it's a chat with a single contact, there will be only 1 value in the array if the contact has their livelocation on.
     * Please note. This should only be called once every 30 or so seconds. This forces the phone to grab the latest live location data for the number. This can be used in conjunction with onLiveLocation (this will trigger onLiveLocation).
     * @param chatId string Id of the chat you want to force the phone to get the livelocation data for.
     * @returns `Promise<LiveLocationChangedEvent []>` | boolean
     */
    forceUpdateLiveLocation(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId }) => WAPI.forceUpdateLiveLocation(chatId), { chatId });
        });
    }
    /**
     * Test the button commands on MD accounts with an insiders key. This is a temporary feature to help fix issue #2658
     */
    testButtons(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId }) => WAPI.testButtons(chatId), { chatId });
        });
    }
    link(params) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const _p = [(_a = this._createConfig) === null || _a === void 0 ? void 0 : _a.linkParams, params].filter(x => x).join('&');
            return `https://get.openwa.dev/l/${yield this.getHostNumber()}${_p ? `?${_p}` : ''}`;
        });
    }
    /**
     * Generate a license link
     */
    getLicenseLink(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.link(params);
        });
    }
    /**
     *
     * {@license:restricted@}
     *
     * Sends a text message to given chat
     *
     * A license is **NOT** required to send messages with existing chats/contacts. A license is only required for starting conversations with new numbers.
     *
     * @param to chat id: `xxxxx@c.us`
     * @param content text message
     */
    sendText(to, content) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!content)
                content = '';
            if (typeof content !== 'string')
                content = String(content);
            const err = [
                'Not able to send message to broadcast',
                'Not a contact',
                'Error: Number not linked to WhatsApp Account',
                'ERROR: Please make sure you have at least one chat'
            ];
            content = (content === null || content === void 0 ? void 0 : content.trim()) || content;
            const res = yield this.pup(({ to, content }) => {
                WAPI.sendSeen(to);
                return WAPI.sendMessage(to, content);
            }, { to, content });
            if (err.includes(res)) {
                let msg = res;
                if (res == err[1])
                    msg = `ERROR: ${res}. Unlock this feature and support open-wa by getting a license: ${yield this.link()}`;
                console.error(`\n${msg}\n`);
                return this.responseWrap(msg);
            }
            return (err.includes(res) ? false : res);
        });
    }
    /**
     * Sends a text message to given chat that includes mentions.
     * In order to use this method correctly you will need to send the text like this:
     * "@4474747474747 how are you?"
     * Basically, add a @ symbol before the number of the contact you want to mention.
     *
     * @param to chat id: `xxxxx@c.us`
     * @param content text message
     * @param hideTags Removes all tags within the message
     * @param mentions You can optionally add an array of contact IDs to tag only specific people
     */
    sendTextWithMentions(to, content, hideTags, mentions) {
        return __awaiter(this, void 0, void 0, function* () {
            //remove all @c.us from the content
            content = content.replace(/@c.us/, "");
            return yield this.pup(({ to, content, hideTags, mentions }) => {
                WAPI.sendSeen(to);
                return WAPI.sendMessageWithMentions(to, content, hideTags, mentions);
            }, { to, content, hideTags, mentions });
        });
    }
    /**
     * NOTE: This is experimental, most accounts do not have access to this feature in their apps.
     *
     * Edit an existing message
     *
     * @param messageId The message ID to edit
     * @param text The new text content
     * @returns
     */
    editMessage(messageId, text) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ messageId, text }) => {
                return WAPI.editMessage(messageId, text);
            }, { messageId, text });
        });
    }
    /**
     * [UNTESTED - REQUIRES FEEDBACK]
     * Sends a payment request message to given chat
     *
     * @param to chat id: `xxxxx@c.us`
     * @param amount number the amount to request in 1000 format (e.g £10 => 10000)
     * @param currency string The 3 letter currency code
     * @param message string optional message to send with the payment request
     */
    sendPaymentRequest(to, amount, currency, message) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, amount, currency, message }) => {
                return WAPI.sendPaymentRequest(to, amount, currency, message);
            }, { to, amount, currency, message });
        });
    }
    /**
     * {@license:insiders@}
     *
     * Send generic quick reply buttons. This is an insiders feature for MD accounts.
     *
     * @param  {ChatId} to chat id
     * @param  {string | LocationButtonBody} body The body of the buttons message
     * @param  {Button[]} buttons Array of buttons - limit is 3!
     * @param  {string} title The title/header of the buttons message
     * @param  {string} footer The footer of the buttons message
     */
    sendButtons(to, body, buttons, title, footer) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, body, buttons, title, footer }) => {
                return WAPI.sendButtons(to, body, buttons, title, footer);
            }, { to, body, buttons, title, footer });
        });
    }
    /**
     * {@license:insiders@}
     *
     * Send advanced buttons with media body. This is an insiders feature for MD accounts.
     *
     * :::caution
     *
     *  Button messages are being progressively handicapped by recipient mobile devices. Some recipients may not see some types of button messages even though their devices will receive them.
     *
     * :::
     *
     * Body can be location, image, video or document. Buttons can be quick reply, url or call buttons.
     *
     * @param  {ChatId} to chat id
     * @param  {string | LocationButtonBody} body The body of the buttons message
     * @param  {AdvancedButton[]} buttons Array of buttons - limit is 3!
     * @param  {string} title The title/header of the buttons message
     * @param  {string} footer The footer of the buttons message
     * @param  {string} filename Required if body is a file!!
     */
    sendAdvancedButtons(to, body, buttons, text, footer, filename) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof body !== "string" && body.lat) {
                //this is a location body
                // eslint-disable-next-line no-self-assign
                body = body;
            }
            else if (typeof body == "string" && !(0, tools_1.isDataURL)(body) && !(0, tools_1.isBase64)(body) && !body.includes("data:")) {
                //must be a file then
                const relativePath = path.join(path.resolve(process.cwd(), body || ''));
                if (typeof body == "string" && fs.existsSync(body) || fs.existsSync(relativePath)) {
                    body = yield (0, datauri_1.default)(fs.existsSync(body) ? body : relativePath);
                }
                else if (typeof body == "string" && (0, is_url_superb_1.default)(body)) {
                    body = yield (0, tools_1.getDUrl)(body);
                }
                else
                    throw new errors_1.CustomError(errors_1.ERROR_NAME.FILE_NOT_FOUND, `Cannot find file. Make sure the file reference is relative, a valid URL or a valid DataURL: ${body.slice(0, 25)}`);
            }
            else if (typeof body == "string" && (body.includes("data:") && body.includes("undefined") || body.includes("application/octet-stream") && filename && mime_types_1.default.lookup(filename))) {
                body = `data:${mime_types_1.default.lookup(filename)};base64,${body.split(',')[1]}`;
            }
            return yield this.pup(({ to, body, buttons, text, footer, filename }) => {
                return WAPI.sendAdvancedButtons(to, body, buttons, text, footer, filename);
            }, { to, body, buttons, text, footer, filename });
        });
    }
    /**
     * Send a banner image
     *
     * Note this is a bit of hack on top of a location message. During testing it is shown to not work on iPhones.
     *
     * @param  {ChatId} to
     * @param  {Base64} base64 base64 encoded jpeg
     */
    sendBanner(to, base64) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, base64 }) => {
                return WAPI.sendBanner(to, base64);
            }, { to, base64 });
        });
    }
    /**
     * {@license:insiders@}
     *
     * Send a list message. This will not work when being sent from business accounts!
     *
     * @param  {ChatId} to
     * @param  {Section[]} sections The Sections of rows for the list message
     * @param  {string} title The title of the list message
     * @param  {string} description The description of the list message
     * @param  {string} actionText The action text of the list message
     */
    sendListMessage(to, sections, title, description, actionText) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, sections, title, description, actionText }) => {
                return WAPI.sendListMessage(to, sections, title, description, actionText);
            }, { to, sections, title, description, actionText });
        });
    }
    /**
     * Sends a reply to given chat that includes mentions, replying to the provided replyMessageId.
     * In order to use this method correctly you will need to send the text like this:
     * "@4474747474747 how are you?"
     * Basically, add a @ symbol before the number of the contact you want to mention.
     * @param to chat id: `xxxxx@c.us`
     * @param content text message
     * @param replyMessageId id of message to reply to
     * @param hideTags Removes all tags within the message
     * @param mentions You can optionally add an array of contact IDs to tag only specific people
     */
    sendReplyWithMentions(to, content, replyMessageId, hideTags, mentions) {
        return __awaiter(this, void 0, void 0, function* () {
            //remove all @c.us from the content
            content = content.replace(/@c.us/, "");
            return yield this.pup(({ to, content, replyMessageId, hideTags, mentions }) => {
                WAPI.sendSeen(to);
                return WAPI.sendReplyWithMentions(to, content, replyMessageId, hideTags, mentions);
            }, { to, content, replyMessageId, hideTags, mentions });
        });
    }
    /**
     * {@license:insiders@}
     *
     * Tags everyone in the group with a message
     *
     * @param groupId group chat id: `xxxxx@g.us`
     * @param content text message to add under all of the tags
     * @param hideTags Removes all tags within the message
     * @param formatting The formatting of the tags. Use @mention to indicate the actual tag. @default `@mention `
     * @param messageBeforeTags set to `true` to show the message before all of the tags
     * @returns `Promise<MessageId>`
     */
    tagEveryone(groupId, content, hideTags, formatting, messageBeforeTags) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ groupId, content, hideTags, formatting, messageBeforeTags }) => WAPI.tagEveryone(groupId, content, hideTags, formatting, messageBeforeTags), { groupId, content, hideTags, formatting, messageBeforeTags });
        });
    }
    /**
     * Sends a link to a chat that includes a link preview.
     * @param thumb The base 64 data of the image you want to use as the thunbnail. This should be no more than 200x200px. Note: Dont need data url on this param
     * @param url The link you want to send
     * @param title The title of the link
     * @param description The long description of the link preview
     * @param text The text you want to inslude in the message section. THIS HAS TO INCLUDE THE URL otherwise the url will be prepended to the text automatically.
     * @param chatId The chat you want to send this message to.
     *
     */
    sendMessageWithThumb(thumb, url, title, description, text, chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ thumb, url, title, description, text, chatId }) => {
                WAPI.sendMessageWithThumb(thumb, url, title, description, text, chatId);
            }, {
                thumb,
                url,
                title,
                description,
                text,
                chatId
            });
        });
    }
    /**
     * Note: `address` and `url` are parameters available to insiders only.
     *
     * Sends a location message to given chat
     * @param to chat id: `xxxxx@c.us`
     * @param lat latitude: '51.5074'
     * @param lng longitude: '0.1278'
     * @param loc location text: 'LONDON!'
     * @param address address text: '1 Regents Park!'
     * @param url address text link: 'https://example.com'
     */
    sendLocation(to, lat, lng, loc, address, url) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, lat, lng, loc, address, url }) => WAPI.sendLocation(to, lat, lng, loc, address, url), { to, lat, lng, loc, address, url });
        });
    }
    /**
     * Get the generated user agent, this is so you can send it to the decryption module.
     * @returns String useragent of wa-web session
     */
    getGeneratedUserAgent(userA) {
        return __awaiter(this, void 0, void 0, function* () {
            const ua = userA || puppeteer_config_1.useragent;
            return yield this.pup(({ ua }) => WAPI.getGeneratedUserAgent(ua), { ua });
        });
    }
    /**
     * Decrypts a media message.
     * @param message This can be the serialized [[MessageId]] or the whole [[Message]] object. It is advised to just use the serialized message ID.
     * @returns `Promise<[[DataURL]]>`
     */
    decryptMedia(message) {
        return __awaiter(this, void 0, void 0, function* () {
            let m;
            //if it's the message id, get the message
            if (typeof message === "string")
                m = yield this.getMessageById(message);
            else
                m = message;
            if (!m.mimetype)
                throw new errors_1.CustomError(errors_1.ERROR_NAME.NOT_MEDIA, "Not a media message");
            if (m.type == "sticker")
                m = yield this.getStickerDecryptable(m.id);
            //Dont have an insiders license to decrypt stickers
            if (m === false) {
                console.error(`\nUnable to decrypt sticker. Unlock this feature and support open-wa by getting a license: ${yield this.link("v=i")}\n`);
                throw new errors_1.CustomError(errors_1.ERROR_NAME.STICKER_NOT_DECRYPTED, 'Sticker not decrypted');
            }
            const mediaData = yield (0, wa_decrypt_1.decryptMedia)(m);
            return `data:${m.mimetype};base64,${mediaData.toString('base64')}`;
        });
    }
    /**
     * Sends a image to given chat, with caption or not, using base64
     * @param to chat id `xxxxx@c.us`
     * @param file DataURL data:image/xxx;base64,xxx or the RELATIVE (should start with `./` or `../`) path of the file you want to send. With the latest version, you can now set this to a normal URL (for example [GET] `https://file-examples-com.github.io/uploads/2017/10/file_example_JPG_2500kB.jpg`).
     * @param filename string xxxxx
     * @param caption string xxxxx
     * @param waitForKey boolean default: false set this to true if you want to wait for the id of the message. By default this is set to false as it will take a few seconds to retrieve to the key of the message and this waiting may not be desirable for the majority of users.
     * @param hideTags boolean default: false [INSIDERS] set this to try silent tag someone in the caption
     * @returns `Promise <boolean | string>` This will either return true or the id of the message. It will return true after 10 seconds even if waitForId is true
     */
    sendImage(to, file, filename, caption, quotedMsgId, waitForId, ptt, withoutPreview, hideTags, viewOnce, requestConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            const err = [
                'Not able to send message to broadcast',
                'Not a contact',
                'Error: Number not linked to WhatsApp Account',
                'ERROR: Please make sure you have at least one chat'
            ];
            /**
             * TODO: File upload improvements
             * 1. *Create an arbitrary file input element
             * 2. *Take the file parameter and create a tempfile in temp dir
             * 3. Forward the tempfile path to the file input, upload the file to the browser context.
             * 4. Instruct the WAPI.sendImage function to consume the file from the element in step 1.
             * 5. *Destroy the input element from the page (happens in wapi.sendimage)
             * 6. *Unlink/rm the tempfile
             * 7. Return the ID of the WAPI.sendImage function.
             */
            const [[inputElementId, inputElement], fileAsLocalTemp] = yield Promise.all([
                (() => __awaiter(this, void 0, void 0, function* () {
                    const inputElementId = yield this._page.evaluate(() => WAPI.createTemporaryFileInput());
                    const inputElement = yield this._page.$(`#${inputElementId}`);
                    return [inputElementId, inputElement];
                }))(),
                (0, tools_1.assertFile)(file, filename, tools_1.FileOutputTypes.TEMP_FILE_PATH, requestConfig || {})
            ]);
            //@ts-ignore
            yield inputElement.uploadFile(fileAsLocalTemp);
            file = inputElementId;
            /**
             * Old method of asserting that the file be a data url - cons = time wasted serializing/deserializing large file to and from b64.
             */
            // file = await assertFile(file, filename, FileOutputTypes.DATA_URL as any,requestConfig || {}) as string
            const res = yield this.pup(({ to, file, filename, caption, quotedMsgId, waitForId, ptt, withoutPreview, hideTags, viewOnce }) => WAPI.sendImage(file, to, filename, caption, quotedMsgId, waitForId, ptt, withoutPreview, hideTags, viewOnce), { to, file, filename, caption, quotedMsgId, waitForId, ptt, withoutPreview, hideTags, viewOnce });
            if (fileAsLocalTemp)
                yield (0, tools_1.rmFileAsync)(fileAsLocalTemp);
            if (err.includes(res))
                console.error(res);
            return (err.includes(res) ? false : res);
        });
    }
    /**
     * Automatically sends a youtube link with the auto generated link preview. You can also add a custom message.
     * @param chatId
     * @param url string A youtube link.
     * @param text string Custom text as body of the message, this needs to include the link or it will be appended after the link.
     * @param thumbnail string Base64 of the jpeg/png which will be used to override the automatically generated thumbnail.
     */
    sendYoutubeLink(to, url, text = '', thumbnail) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendLinkWithAutoPreview(to, url, text, thumbnail);
        });
    }
    /**
     * Automatically sends a link with the auto generated link preview. You can also add a custom message.
     * @param chatId
     * @param url string A link.
     * @param text string Custom text as body of the message, this needs to include the link or it will be appended after the link.
     * @param thumbnail Base64 of the jpeg/png which will be used to override the automatically generated thumbnail.
     */
    sendLinkWithAutoPreview(to, url, text, thumbnail) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let linkData;
            let thumb;
            try {
                linkData = (yield axios_1.default.get(`${((_a = this._createConfig) === null || _a === void 0 ? void 0 : _a.linkParser) || "https://link.openwa.cloud/api"}?url=${url}`)).data;
                logging_1.log.info("Got link data", linkData);
                if (!thumbnail)
                    thumb = yield (0, tools_1.getDUrl)(linkData.image);
            }
            catch (error) {
                logging_1.log.error(error);
            }
            if (linkData && (thumbnail || thumb))
                return yield this.sendMessageWithThumb(thumbnail || thumb, url, linkData.title, linkData.description, text, to);
            else
                return yield this.pup(({ to, url, text, thumbnail }) => WAPI.sendLinkWithAutoPreview(to, url, text, thumbnail), { to, url, text, thumbnail });
        });
    }
    /**
     *
     * Sends a reply to a given message. Please note, you need to have at least sent one normal message to a contact in order for this to work properly.
     *
     * @param to string chatid
     * @param content string reply text
     * @param quotedMsgId string the msg id to reply to.
     * @param sendSeen boolean If set to true, the chat will 'blue tick' all messages before sending the reply
     * @returns `Promise<MessageId | false>` false if didn't work, otherwise returns message id.
     */
    reply(to, content, quotedMsgId, sendSeen) {
        return __awaiter(this, void 0, void 0, function* () {
            if (sendSeen)
                yield this.sendSeen(to);
            return yield this.pup(({ to, content, quotedMsgId }) => WAPI.reply(to, content, quotedMsgId), { to, content, quotedMsgId });
        });
    }
    /**
     * {@license:insiders@}
     *
     * Check if a recipient has read receipts on.
     *
     * This will only work if you have chats sent back and forth between you and the contact 1-1.
     *
     * @param contactId The Id of the contact with which you have an existing conversation with messages already.
     * @returns `Promise<string | boolean>` true or false or a string with an explaintaion of why it wasn't able to determine the read receipts.
     *
     */
    checkReadReceipts(contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ contactId }) => WAPI.checkReadReceipts(contactId), { contactId });
        });
    }
    /**
     * Sends a file to given chat, with caption or not, using base64. This is exactly the same as sendImage
     *
     * Please note that any file that resolves to mime-type `octet-stream` will, by default, resolve to an MP4 file.
     *
     * If you want a specific filetype, then explcitly select the correct mime-type from https://www.iana.org/assignments/media-types/media-types.xhtml
     *
     *
     * @param to chat id `xxxxx@c.us`
     * @param file DataURL data:image/xxx;base64,xxx or the RELATIVE (should start with `./` or `../`) path of the file you want to send. With the latest version, you can now set this to a normal URL (for example [GET] `https://file-examples-com.github.io/uploads/2017/10/file_example_JPG_2500kB.jpg`).
     * @param filename string xxxxx
     * @param caption string xxxxx With an [INSIDERS LICENSE-KEY](https://gum.co/open-wa?tier=Insiders%20Program) you can also tag people in groups with `@[number]`. For example if you want to mention the user with the number `44771234567`, just add `@44771234567` in the caption.
     * @param quotedMsgId string true_0000000000@c.us_JHB2HB23HJ4B234HJB to send as a reply to a message
     * @param waitForId boolean default: false set this to true if you want to wait for the id of the message. By default this is set to false as it will take a few seconds to retrieve to the key of the message and this waiting may not be desirable for the majority of users.
     * @param ptt boolean default: false set this to true if you want to send the file as a push to talk file.
     * @param withoutPreview boolean default: false set this to true if you want to send the file without a preview (i.e as a file). This is useful for preventing auto downloads on recipient devices.
     * @param hideTags boolean default: false [INSIDERS] set this to try silent tag someone in the caption
     * @returns `Promise <boolean | MessageId>` This will either return true or the id of the message. It will return true after 10 seconds even if waitForId is true
     */
    sendFile(to, file, filename, caption, quotedMsgId, waitForId, ptt, withoutPreview, hideTags, viewOnce, requestConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendImage(to, file, filename, caption, quotedMsgId, waitForId, ptt, withoutPreview, hideTags, viewOnce, requestConfig);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Checks whether or not the group id provided is known to be unsafe by the contributors of the library.
     * @param groupChatId The group chat you want to deteremine is unsafe
     * @returns `Promise <boolean | string>` This will either return a boolean indiciating whether this group chat id is considered unsafe or an error message as a string
     */
    isGroupIdUnsafe(groupChatId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield axios_1.default.post('https://openwa.dev/groupId-check', {
                groupChatId,
                sessionInfo: this.getSessionInfo(),
                config: this.getConfig()
            });
            if (data.unsafe)
                console.warn(`${groupChatId} is marked as unsafe`);
            return data.err || data.unsafe;
        });
    }
    /**
     * Attempts to send a file as a voice note. Useful if you want to send an mp3 file.
     * @param to chat id `xxxxx@c.us`
     * @param file base64 data:image/xxx;base64,xxx or the path of the file you want to send.
     * @param quotedMsgId string true_0000000000@c.us_JHB2HB23HJ4B234HJB to send as a reply to a message
     * @returns `Promise <boolean | string>` This will either return true or the id of the message. It will return true after 10 seconds even if waitForId is true
     */
    sendPtt(to, file, quotedMsgId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendImage(to, file, 'ptt.ogg', '', quotedMsgId ? quotedMsgId : null, true, true);
        });
    }
    /**
     * Send an audio file with the default audio player (not PTT/voice message)
     * @param to chat id `xxxxx@c.us`
     * @param base64 base64 data:image/xxx;base64,xxx or the path of the file you want to send.
     * @param quotedMsgId string true_0000000000@c.us_JHB2HB23HJ4B234HJB to send as a reply to a message
     */
    sendAudio(to, file, quotedMsgId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendFile(to, file, 'file.mp3', '', quotedMsgId, true, false, false, false);
        });
    }
    /**
     * Send a poll to a group chat
     * @param to chat id - a group chat is required
     * @param name the name of the poll
     * @param options an array of poll options
     * @param quotedMsgId A message to quote when sending the poll
     * @param allowMultiSelect Whether or not to allow multiple selections. default false
     */
    sendPoll(to, name, options, quotedMsgId, allowMultiSelect) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, name, options, quotedMsgId, allowMultiSelect }) => {
                return WAPI.sendPoll(to, name, options, quotedMsgId, allowMultiSelect);
            }, { to, name, options, quotedMsgId, allowMultiSelect });
        });
    }
    /**
     * Sends a video to given chat as a gif, with caption or not, using base64
     * @param to chat id `xxxxx@c.us`
     * @param file DataURL data:image/xxx;base64,xxx or the RELATIVE (should start with `./` or `../`) path of the file you want to send. With the latest version, you can now set this to a normal URL (for example [GET] `https://file-examples-com.github.io/uploads/2017/10/file_example_JPG_2500kB.jpg`).
     * @param filename string xxxxx
     * @param caption string xxxxx
     * @param quotedMsgId string true_0000000000@c.us_JHB2HB23HJ4B234HJB to send as a reply to a message
     * @param requestConfig {} By default the request is a get request, however you can override that and many other options by sending this parameter. You can read more about this parameter here: https://github.com/axios/axios#request-config
     */
    sendVideoAsGif(to, file, filename, caption, quotedMsgId, requestConfig = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            //check if the 'base64' file exists
            if (!(0, tools_1.isDataURL)(file)) {
                //must be a file then
                const relativePath = path.join(path.resolve(process.cwd(), file || ''));
                if (fs.existsSync(file) || fs.existsSync(relativePath)) {
                    file = yield (0, datauri_1.default)(fs.existsSync(file) ? file : relativePath);
                }
                else if ((0, is_url_superb_1.default)(file)) {
                    file = yield (0, tools_1.getDUrl)(file, requestConfig);
                }
                else
                    throw new errors_1.CustomError(errors_1.ERROR_NAME.FILE_NOT_FOUND, 'Cannot find file. Make sure the file reference is relative, a valid URL or a valid DataURL');
            }
            return yield this.pup(({ to, file, filename, caption, quotedMsgId }) => {
                return WAPI.sendVideoAsGif(file, to, filename, caption, quotedMsgId);
            }, { to, file, filename, caption, quotedMsgId });
        });
    }
    /**
     * Sends a video to given chat as a gif by using a giphy link, with caption or not, using base64
     * @param to chat id `xxxxx@c.us`
     * @param giphyMediaUrl string https://media.giphy.com/media/oYtVHSxngR3lC/giphy.gif => https://i.giphy.com/media/oYtVHSxngR3lC/200w.mp4
     * @param caption string xxxxx
     */
    sendGiphy(to, giphyMediaUrl, caption) {
        return __awaiter(this, void 0, void 0, function* () {
            const ue = /^https?:\/\/media\.giphy\.com\/media\/([a-zA-Z0-9]+)/;
            const n = ue.exec(giphyMediaUrl);
            if (n) {
                const r = `https://i.giphy.com/${n[1]}.mp4`;
                const filename = `${n[1]}.mp4`;
                const dUrl = yield (0, tools_1.getDUrl)(r);
                return yield this.pup(({ to, dUrl, filename, caption }) => {
                    WAPI.sendVideoAsGif(dUrl, to, filename, caption);
                }, { to, dUrl, filename, caption });
            }
            else {
                console.log('something is wrong with this giphy link');
                logging_1.log.error('something is wrong with this giphy link', giphyMediaUrl);
                return;
            }
        });
    }
    /**
     * Sends a file by Url or custom options
     * @param to chat id `xxxxx@c.us`
     * @param url string https://i.giphy.com/media/oYtVHSxngR3lC/200w.mp4
     * @param filename string 'video.mp4'
     * @param caption string xxxxx
     * @param quotedMsgId string true_0000000000@c.us_JHB2HB23HJ4B234HJB to send as a reply to a message
     * @param requestConfig {} By default the request is a get request, however you can override that and many other options by sending this parameter. You can read more about this parameter here: https://github.com/axios/axios#request-config
     * @param waitForId boolean default: false set this to true if you want to wait for the id of the message. By default this is set to false as it will take a few seconds to retrieve to the key of the message and this waiting may not be desirable for the majority of users.
     * @param ptt boolean default: false set this to true if you want to send the file as a push to talk file.
     * @param withoutPreview boolean default: false set this to true if you want to send the file without a preview (i.e as a file). This is useful for preventing auto downloads on recipient devices.
     */
    sendFileFromUrl(to, url, filename, caption, quotedMsgId, requestConfig = {}, waitForId, ptt, withoutPreview, hideTags, viewOnce) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sendFile(to, url, filename, caption, quotedMsgId, waitForId, ptt, withoutPreview, hideTags, viewOnce, requestConfig);
        });
    }
    /**
     * Returns an object with all of your host device details
     */
    getMe() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._page.evaluate(() => WAPI.getMe());
        });
    }
    /**
     * Returns an object with properties of internal features and boolean values that represent if the respective feature is enabled or not.
     */
    getFeatures() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._page.evaluate(() => WAPI.getFeatures());
        });
    }
    /**
     * Returns a PNG DataURL screenshot of the session
     * @param chatId Chat ID to open before taking a snapshot
     * @param width Width of the viewport for the snapshot. Height also required if you want to resize.
     * @param height Height of the viewport for the snapshot. Width also required if you want to resize.
     * @returns `Promise<DataURL>`
     */
    getSnapshot(chatId, width, height) {
        return __awaiter(this, void 0, void 0, function* () {
            if (width && height)
                yield this.resizePage(width, height);
            const snapshotElement = chatId ? yield this._page.evaluateHandle(({ chatId }) => WAPI.getSnapshotElement(chatId), { chatId }) : this.getPage();
            const screenshot = yield snapshotElement.screenshot({
                type: "png",
                encoding: "base64"
            });
            return `data:image/png;base64,${screenshot}`;
        });
    }
    /**
     * Returns some metrics of the session/page.
     * @returns `Promise<any>`
     */
    metrics() {
        return __awaiter(this, void 0, void 0, function* () {
            const metrics = yield this._page.metrics();
            const sessionMetrics = yield this.pup(() => WAPI.launchMetrics());
            const res = Object.assign(Object.assign({}, (metrics || {})), (sessionMetrics || {}));
            logging_1.log.info("Metrics:", res);
            return res;
        });
    }
    /**
     * Returns an array of group ids where the host account is admin
     */
    iAmAdmin() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.iAmAdmin());
        });
    }
    /**
     * Returns an array of group ids where the host account has been kicked
     */
    getKickedGroups() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getKickedGroups());
        });
    }
    /**
     * Syncs contacts with phone. This promise does not resolve so it will instantly return true.
     */
    syncContacts() {
        return __awaiter(this, void 0, void 0, function* () {
            //@ts-ignore
            return yield this.pup(() => WAPI.syncContacts());
        });
    }
    /**
     * Easily get the amount of messages loaded up in the session. This will allow you to determine when to clear chats/cache.
     */
    getAmountOfLoadedMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getAmountOfLoadedMessages());
        });
    }
    /**
     * Find any product listings of the given number. Use this to query a catalog
     *
     * @param id id of buseinss profile (i.e the number with @c.us)
     * @returns None
     */
    getBusinessProfilesProducts(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ id }) => WAPI.getBusinessProfilesProducts(id), { id });
        });
    }
    /**
     * Sends product with image to chat
     * @param imgBase64 Base64 image data
     * @param chatid string the id of the chat that you want to send this product to
     * @param caption string the caption you want to add to this message
     * @param bizNumber string the @c.us number of the business account from which you want to grab the product
     * @param productId string the id of the product within the main catalog of the aforementioned business
     * @returns
     */
    sendImageWithProduct(to, image, caption, bizNumber, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, image, bizNumber, caption, productId }) => {
                WAPI.sendImageWithProduct(image, to, caption, bizNumber, productId);
            }, { to, image, bizNumber, caption, productId });
        });
    }
    /**
     * @deprecated
     * Feature Currently only available with Premium License accounts.
     *
     * Send a custom product to a chat. Please see [[CustomProduct]] for details.
     *
     * Caveats:
     * - URL will not work (unable to click), you will have to send another message with the URL.
     * - Recipient will see a thin banner under picture that says "Something went wrong"
     * - This will only work if you have at least 1 product already in your catalog
     * - Only works on Business accounts
     */
    sendCustomProduct(to, image, productData) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, image, productData }) => WAPI.sendCustomProduct(to, image, productData), { to, image, productData });
        });
    }
    /**
     * Sends contact card to given chat id. You can use this to send multiple contacts but they will show up as multiple single-contact messages.
     * @param {string} to 'xxxx@c.us'
     * @param {string|array} contact 'xxxx@c.us' | ['xxxx@c.us', 'yyyy@c.us', ...]
     */
    sendContact(to, contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, contactId }) => WAPI.sendContact(to, contactId), { to, contactId });
        });
    }
    /**
     *
     * {@license:insiders@}
     *
     * Sends multiple contacts as a single message
     *
     * @param  to 'xxxx@c.us'
     * @param contact ['xxxx@c.us', 'yyyy@c.us', ...]
     */
    sendMultipleContacts(to, contactIds) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, contactIds }) => WAPI.sendMultipleContacts(to, contactIds), { to, contactIds });
        });
    }
    /**
     * Simulate '...typing' in chat
     * @param {string} to 'xxxx@c.us'
     * @param {boolean} on turn on similated typing, false to turn it off you need to manually turn this off.
     */
    simulateTyping(to, on) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, on }) => WAPI.simulateTyping(to, on), { to, on });
        });
    }
    /**
     * Simulate '...recording' in chat
     * @param {string} to 'xxxx@c.us'
     * @param {boolean} on turn on similated recording, false to turn it off you need to manually turn this off.
     */
    simulateRecording(to, on) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, on }) => WAPI.simulateRecording(to, on), { to, on });
        });
    }
    /**
     * @param id The id of the conversation
     * @param archive boolean true => archive, false => unarchive
     * @return boolean true: worked, false: didnt work (probably already in desired state)
     */
    archiveChat(id, archive) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ id, archive }) => WAPI.archiveChat(id, archive), { id, archive });
        });
    }
    /**
     * Pin/Unpin chats
     *
     * @param id The id of the conversation
     * @param archive boolean true => pin, false => unpin
     * @return boolean true: worked
     */
    pinChat(id, pin) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ id, pin }) => WAPI.pinChat(id, pin), { id, pin });
        });
    }
    /**
     *
     * {@license:insiders@}
     *
     * Mutes a conversation for a given duration. If already muted, this will update the muted duration. Mute durations are relative from when the method is called.
     * @param chatId The id of the conversation you want to mute
     * @param muteDuration ChatMuteDuration enum of the time you want this chat to be muted for.
     * @return boolean true: worked or error code or message
     */
    muteChat(chatId, muteDuration) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId, muteDuration }) => WAPI.muteChat(chatId, muteDuration), { chatId, muteDuration });
        });
    }
    /**
     * Checks if a chat is muted
     * @param chatId The id of the chat you want to check
     * @returns boolean. `false` if the chat does not exist.
     */
    isChatMuted(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId }) => WAPI.isChatMuted(chatId), { chatId });
        });
    }
    /**
     *
     * {@license:insiders@}
     *
     * Unmutes a conversation.
     * @param id The id of the conversation you want to mute
     * @return boolean true: worked or error code or message
     */
    unmuteChat(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId }) => WAPI.unmuteChat(chatId), { chatId });
        });
    }
    /**
     * Forward an array of messages to a specific chat using the message ids or Objects
     *
     * @param to '000000000000@c.us'
     * @param messages this can be any mixture of message ids or message objects
     * @param skipMyMessages This indicates whether or not to skip your own messages from the array
     */
    forwardMessages(to, messages, skipMyMessages) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, messages, skipMyMessages }) => WAPI.forwardMessages(to, messages, skipMyMessages), { to, messages, skipMyMessages });
        });
    }
    /**
     * Ghost forwarding is like a normal forward but as if it were sent from the host phone [i.e it doesn't show up as forwarded.]
     * Any potential abuse of this method will see it become paywalled.
     * @param to: Chat id to forward the message to
     * @param messageId: message id of the message to forward. Please note that if it is not loaded, this will return false - even if it exists.
     * @returns `Promise<MessageId | boolean>`
     */
    ghostForward(to, messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, messageId }) => WAPI.ghostForward(to, messageId), { to, messageId });
        });
    }
    /**
     * Retrieves all contacts
     * @returns array of [Contact]
     */
    getAllContacts() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getAllContacts());
        });
    }
    getWAVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getWAVersion());
        });
    }
    /**
     * Generate a pre-filled github issue link to easily report a bug
     */
    getIssueLink() {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, tools_1.generateGHIssueLink)(this.getConfig(), this.getSessionInfo());
        });
    }
    /**
     * Retrieves if the phone is online. Please note that this may not be real time.
     * @returns Boolean
     */
    isConnected() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.isConnected());
        });
    }
    /**
     * Logs out from the session.
     * @param preserveSessionData skip session.data.json file invalidation
     * Please be careful when using this as it can exit the whole process depending on your config
     */
    logout(preserveSessionData = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!preserveSessionData) {
                logging_1.log.info(`LOGOUT CALLED. INVALIDATING SESSION DATA`);
                yield (0, browser_1.invalidateSesssionData)(this._createConfig);
            }
            return yield this.pup(() => WAPI.logout());
        });
    }
    /**
     * Retrieves Battery Level
     * @returns Number
     */
    getBatteryLevel() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getBatteryLevel());
        });
    }
    /**
     * Retrieves whether or not phone is plugged in (i.e on charge)
     * @returns Number
     */
    getIsPlugged() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getIsPlugged());
        });
    }
    /**
     * Retrieves the host device number. Use this number when registering for a license key
     * @returns Number
     */
    getHostNumber() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hostAccountNumber)
                this._hostAccountNumber = (yield this.pup(() => WAPI.getHostNumber()));
            return this._hostAccountNumber;
        });
    }
    /**
     * Returns the the type of license key used by the session.
     * @returns
     */
    getLicenseType() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getLicenseType());
        });
    }
    /**
     * The EASY API uses this string to secure a subdomain on the openwa public tunnel service.
     * @returns
     */
    getTunnelCode() {
        return __awaiter(this, void 0, void 0, function* () {
            const sessionId = this.getSessionId();
            return yield this.pup(sessionId => WAPI.getTunnelCode(sessionId), sessionId);
        });
    }
    /**
     * Get an array of chatIds with their respective last message's timestamp.
     *
     * This is useful for determining what chats are old/stale and need to be deleted.
     */
    getLastMsgTimestamps() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getLastMsgTimestamps());
        });
    }
    /**
     * Retrieves all chats
     * @returns array of [Chat]
     */
    getAllChats(withNewMessageOnly = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (withNewMessageOnly) {
                return yield this.pup(() => WAPI.getAllChatsWithNewMsg());
            }
            else {
                return yield this.pup(() => WAPI.getAllChats());
            }
        });
    }
    /**
     * retrieves all Chat Ids
     * @returns array of [ChatId]
     */
    getAllChatIds() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getAllChatIds());
        });
    }
    /**
     * retrieves an array of IDs of accounts blocked by the host account.
     * @returns `Promise<ChatId[]>`
     */
    getBlockedIds() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getBlockedIds());
        });
    }
    /**
     * @deprecated
     *
     * Retrieves all chats with messages
     *
     * Please use `getAllUnreadMessages` instead of this to see all messages indicated by the green dots in the chat.
     *
     * @returns array of [Chat]
     */
    getAllChatsWithMessages(withNewMessageOnly = false) {
        return __awaiter(this, void 0, void 0, function* () {
            return JSON.parse(yield this.pup(withNewMessageOnly => WAPI.getAllChatsWithMessages(withNewMessageOnly), withNewMessageOnly));
        });
    }
    /**
     * Retrieve all groups
     * @returns array of groups
     */
    getAllGroups(withNewMessagesOnly = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (withNewMessagesOnly) {
                // prettier-ignore
                const chats = yield this.pup(() => WAPI.getAllChatsWithNewMsg());
                return chats.filter(chat => chat.isGroup);
            }
            else {
                const chats = yield this.pup(() => WAPI.getAllChats());
                return chats.filter(chat => chat.isGroup);
            }
        });
    }
    /**
     * Retrieve all commmunity Ids
     * @returns array of group ids
     */
    getAllCommunities() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getCommunities());
        });
    }
    /**
     * Retrieves group members as [Id] objects
     * @param groupId group id
     */
    getGroupMembersId(groupId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(groupId => WAPI.getGroupParticipantIDs(groupId), groupId);
        });
    }
    /**
     * Returns the title and description of a given group id.
     * @param groupId group id
     */
    getGroupInfo(groupId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(groupId => WAPI.getGroupInfo(groupId), groupId);
        });
    }
    /**
     * Returns the community metadata. Like group metadata but with a `subGroups` property which is the group metadata of the community subgroups.
     * @param communityId community id
     */
    getCommunityInfo(communityId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(communityId => WAPI.getCommunityInfo(communityId), communityId);
        });
    }
    /**
     *
     * Accepts a request from a recipient to join a group. Takes the message ID of the request message.
     *
     * @param {string} messageId
     */
    acceptGroupJoinRequest(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(messageId => WAPI.acceptGroupJoinRequest(messageId), messageId);
        });
    }
    /**
     * Retrieves community members Ids
     * @param communityId community id
     */
    getCommunityParticipantIds(communityId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(communityId => WAPI.getCommunityParticipantIds(communityId), communityId);
        });
    }
    /**
     * Retrieves community admin Ids
     * @param communityId community id
     */
    getCommunityAdminIds(communityId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(communityId => WAPI.getCommunityAdminIds(communityId), communityId);
        });
    }
    /**
     * Retrieves community members as Contact objects
     * @param communityId community id
     */
    getCommunityParticipants(communityId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(communityId => WAPI.getCommunityParticipants(communityId), communityId);
        });
    }
    /**
     * Retrieves community admins as Contact objects
     * @param communityId community id
     */
    getCommunityAdmins(communityId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(communityId => WAPI.getCommunityAdmins(communityId), communityId);
        });
    }
    /** Joins a group via the invite link, code, or message
     * @param link This param is the string which includes the invite link or code. The following work:
     * - Follow this link to join my WA group: https://chat.whatsapp.com/DHTGJUfFJAV9MxOpZO1fBZ
     * - https://chat.whatsapp.com/DHTGJUfFJAV9MxOpZO1fBZ
     * - DHTGJUfFJAV9MxOpZO1fBZ
     *
     *  If you have been removed from the group previously, it will return `401`
     *
     * @param returnChatObj boolean When this is set to true and if the group was joined successfully, it will return a serialzed Chat object which includes group information and metadata. This is useful when you want to immediately do something with group metadata.
     *
     *
     * @returns `Promise<string | boolean | number>` Either false if it didn't work, or the group id.
     */
    joinGroupViaLink(link, returnChatObj) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ link, returnChatObj }) => WAPI.joinGroupViaLink(link, returnChatObj), { link, returnChatObj });
        });
    }
    /**
     * Block contact
     * @param {string} id '000000000000@c.us'
     */
    contactBlock(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(id => WAPI.contactBlock(id), id);
        });
    }
    /**
     * {@license:restricted@}
     *
     * Report a contact for spam, block them and attempt to clear chat.
     *
     * @param {string} id '000000000000@c.us'
     */
    reportSpam(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(id => WAPI.REPORTSPAM(id), id);
        });
    }
    /**
     * Unblock contact
     * @param {string} id '000000000000@c.us'
     */
    contactUnblock(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(id => WAPI.contactUnblock(id), id);
        });
    }
    /**
     * Removes the host device from the group
     * @param groupId group id
     */
    leaveGroup(groupId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(groupId => WAPI.leaveGroup(groupId), groupId);
        });
    }
    /**
     * Extracts vcards from a message.This works on messages of typ `vcard` or `multi_vcard`
     * @param msgId string id of the message to extract the vcards from
     * @returns [vcard]
     * ```
     * [
     * {
     * displayName:"Contact name",
     * vcard: "loong vcard string"
     * }
     * ]
     * ```
     * or false if no valid vcards found.
     *
     * Please use [vcf](https://www.npmjs.com/package/vcf) to convert a vcard string into a json object
     */
    getVCards(msgId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(msgId => WAPI.getVCards(msgId), msgId);
        });
    }
    /**
     * Returns group members [Contact] objects
     * @param groupId
     */
    getGroupMembers(groupId) {
        return __awaiter(this, void 0, void 0, function* () {
            const membersIds = yield this.getGroupMembersId(groupId);
            logging_1.log.info("group members ids", membersIds);
            if (!Array.isArray(membersIds)) {
                console.error("group members ids is not an array", membersIds);
                return [];
            }
            const actions = membersIds.map(memberId => {
                return this.getContact(memberId);
            });
            return yield Promise.all(actions);
        });
    }
    /**
     * Retrieves contact detail object of given contact id
     * @param contactId
     * @returns contact detial as promise
     */
    //@ts-ignore
    getContact(contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(contactId => WAPI.getContact(contactId), contactId);
        });
    }
    /**
     * Retrieves chat object of given contact id
     * @param contactId
     * @returns contact detial as promise
     */
    getChatById(contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(contactId => WAPI.getChatById(contactId), contactId);
        });
    }
    /**
     * Retrieves message object of given message id
     * @param messageId
     * @returns message object
     */
    getMessageById(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(messageId => WAPI.getMessageById(messageId), messageId);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Get the detailed message info for a group message sent out by the host account.
     * @param messageId The message Id
     */
    getMessageInfo(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(messageId => WAPI.getMessageInfo(messageId), messageId);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Retrieves an order object
     * @param messageId or OrderId
     * @returns order object
     */
    getOrder(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(id => WAPI.getOrder(id), id);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Add a product to your catalog
     *
     * @param {string} name The name of the product
     * @param {number} price The price of the product
     * @param {string} currency The 3-letter currenct code for the product
     * @param {string[]} images An array of dataurl or base64 strings of product images, the first image will be used as the main image. At least one image is required.
     * @param {string} description optional, the description of the product
     * @param {string} url The url of the product for more information
     * @param {string} internalId The internal/backoffice id of the product
     * @param {boolean} isHidden Whether or not the product is shown publicly in your catalog
     * @returns product object
     */
    createNewProduct(name, price, currency, images, description, url, internalId, isHidden) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(images))
                images = [images];
            images = yield Promise.all(images.map(image => (0, tools_1.ensureDUrl)(image)));
            return yield this.pup(({ name, price, currency, images, description, url, internalId, isHidden }) => WAPI.createNewProduct(name, price, currency, images, description, url, internalId, isHidden), { name, price, currency, images, description, url, internalId, isHidden });
        });
    }
    /**
     * {@license:insiders@}
     *
     * Edit a product in your catalog
     *
     * @param {string} productId The catalog ID of the product
     * @param {string} name The name of the product
     * @param {number} price The price of the product
     * @param {string} currency The 3-letter currenct code for the product
     * @param {string[]} images An array of dataurl or base64 strings of product images, the first image will be used as the main image. At least one image is required.
     * @param {string} description optional, the description of the product
     * @param {string} url The url of the product for more information
     * @param {string} internalId The internal/backoffice id of the product
     * @param {boolean} isHidden Whether or not the product is shown publicly in your catalog
     * @returns product object
     */
    editProduct(productId, name, price, currency, images, description, url, internalId, isHidden) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ productId, name, price, currency, images, description, url, internalId, isHidden }) => WAPI.editProduct(productId, name, price, currency, images, description, url, internalId, isHidden), { productId, name, price, currency, images, description, url, internalId, isHidden });
        });
    }
    /**
     * {@license:insiders@}
     *
     * Send a product to a chat
     *
     * @param {string} chatId The chatId
     * @param {string} productId The id of the product
     * @returns MessageID
     */
    sendProduct(chatId, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId, productId }) => WAPI.sendProduct(chatId, productId), { chatId, productId });
        });
    }
    /**
     *
     * Remove a product from the host account's catalog
     *
     * @param {string} productId The id of the product
     * @returns boolean
     */
    removeProduct(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ productId }) => WAPI.removeProduct(productId), { productId });
        });
    }
    /**
     * Retrieves the last message sent by the host account in any given chat or globally.
     * @param chatId This is optional. If no chat Id is set then the last message sent by the host account will be returned.
     * @returns message object or `undefined` if the host account's last message could not be found.
     */
    getMyLastMessage(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(chatId => WAPI.getMyLastMessage(chatId), chatId);
        });
    }
    /**
     * Retrieves the starred messages in a given chat
     * @param chatId Chat ID to filter starred messages by
     * @returns message object
     */
    getStarredMessages(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(chatId => WAPI.getStarredMessages(chatId), chatId);
        });
    }
    /**
     * Star a message
     * @param messageId Message ID of the message you want to star
     * @returns `true`
     */
    starMessage(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(messageId => WAPI.starMessage(messageId), messageId);
        });
    }
    /**
     * Unstar a message
     * @param messageId Message ID of the message you want to unstar
     * @returns `true`
     */
    unstarMessage(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(messageId => WAPI.unstarMessage(messageId), messageId);
        });
    }
    /**
     * React to a message
     * @param messageId Message ID of the message you want to react to
     * @param emoji 1 single emoji to add to the message as a reacion
     * @returns boolean
     */
    react(messageId, emoji) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ messageId, emoji }) => WAPI.react(messageId, emoji), { messageId, emoji });
        });
    }
    /**
     * @deprecated
     *
     * Retrieves a message object which results in a valid sticker instead of a blank one. This also works with animated stickers.
     *
     * If you run this without a valid insiders key, it will return false and cause an error upon decryption.
     *
     * @param messageId The message ID `message.id`
     * @returns message object OR `false`
     */
    getStickerDecryptable(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            const m = yield this.pup(messageId => WAPI.getStickerDecryptable(messageId), messageId);
            if (!m)
                return false;
            return Object.assign({ t: m.t, id: m.id }, (0, wa_decrypt_1.bleachMessage)(m));
        });
    }
    /**
     *
     * {@license:insiders@}
     *
     * If a file is old enough, it will 404 if you try to decrypt it. This will allow you to force the host account to re upload the file and return a decryptable message.
     *
     * if you run this without a valid insiders key, it will return false and cause an error upon decryption.
     *
     * @param messageId
     * @returns [[Message]] OR `false`
     */
    forceStaleMediaUpdate(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            const m = yield this.pup(messageId => WAPI.forceStaleMediaUpdate(messageId), messageId);
            if (!m)
                return false;
            return Object.assign({}, (0, wa_decrypt_1.bleachMessage)(m));
        });
    }
    /**
     * Retrieves chat object of given contact id
     * @param contactId
     * @returns contact detial as promise
     */
    getChat(contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(contactId => WAPI.getChat(contactId), contactId);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Retrieves the groups that you have in common with a contact
     * @param contactId
     * @returns Promise returning an array of common groups {
     * id:string,
     * title:string
     * }
     */
    getCommonGroups(contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(contactId => WAPI.getCommonGroups(contactId), contactId);
        });
    }
    /**
     * Retrieves the epoch timestamp of the time the contact was last seen. This will not work if:
     * 1. They have set it so you cannot see their last seen via privacy settings.
     * 2. You do not have an existing chat with the contact.
     * 3. The chatId is for a group
     * In both of those instances this method will return undefined.
     * @param chatId The id of the chat.
     * @returns number timestamp when chat was last online or undefined.
     */
    getLastSeen(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(chatId => WAPI.getLastSeen(chatId), chatId);
        });
    }
    /**
     * Retrieves chat picture
     * @param chatId
     * @returns Url of the chat picture or undefined if there is no picture for the chat.
     */
    getProfilePicFromServer(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(chatId => WAPI.getProfilePicFromServer(chatId), chatId);
        });
    }
    /**
     * Sets a chat status to seen. Marks all messages as ack: 3
     * @param chatId chat id: `xxxxx@c.us`
     */
    sendSeen(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(chatId => WAPI.sendSeen(chatId), chatId);
        });
    }
    /**
     * Runs sendSeen on all chats
     */
    markAllRead() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.markAllRead());
        });
    }
    /**
     * Sets a chat status to unread. May be useful to get host's attention
     * @param chatId chat id: `xxxxx@c.us`
     */
    markAsUnread(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(chatId => WAPI.markAsUnread(chatId), chatId);
        });
    }
    /**
     * Checks if a chat contact is online. Not entirely sure if this works with groups.
     *
     * It will return `true` if the chat is `online`, `false` if the chat is `offline`, `PRIVATE` if the privacy settings of the contact do not allow you to see their status and `NO_CHAT` if you do not currently have a chat with that contact.
     *
     * @param chatId chat id: `xxxxx@c.us`
     */
    isChatOnline(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(chatId => WAPI.isChatOnline(chatId), chatId);
        });
    }
    /**
      * Load more messages in chat object from server. Use this in a while loop. This should return up to 50 messages at a time
     * @param contactId
     * @returns Message []
     */
    loadEarlierMessages(contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(contactId => WAPI.loadEarlierMessages(contactId), contactId);
        });
    }
    /**
     * Get the status of a contact
     * @param contactId {string} to '000000000000@c.us'
     * returns: {id: string,status: string}
     */
    getStatus(contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(contactId => WAPI.getStatus(contactId), contactId);
        });
    }
    /**
     *
     * {@license:insiders@}
     *
     * Use a raw payload within your open-wa session
     *
     * @param chatId
     * @param payload {any}
     * returns: MessageId
     */
    B(chatId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId, payload }) => WAPI.B(chatId, payload), { chatId, payload });
        });
    }
    /**
      * Load all messages in chat object from server.
     * @param contactId
     * @returns Message[]
     */
    loadAllEarlierMessages(contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(contactId => WAPI.loadAllEarlierMessages(contactId), contactId);
        });
    }
    /**
      * Load all messages until a given timestamp in chat object from server.
     * @param contactId
     * @param timestamp in seconds
     * @returns Message[]
     */
    loadEarlierMessagesTillDate(contactId, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ contactId, timestamp }) => WAPI.loadEarlierMessagesTillDate(contactId, timestamp), { contactId, timestamp });
        });
    }
    /**
      * Delete the conversation from your WA
     * @param chatId
     * @returns boolean
     */
    deleteChat(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(chatId => WAPI.deleteConversation(chatId), chatId);
        });
    }
    /**
      * Delete all messages from the chat.
     * @param chatId
     * @returns boolean
     */
    clearChat(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(chatId => WAPI.clearChat(chatId), chatId);
        });
    }
    /**
      * Retrieves an invite link for a group chat. returns false if chat is not a group.
     * @param chatId
     * @returns `Promise<string>`
     */
    getGroupInviteLink(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(chatId => WAPI.getGroupInviteLink(chatId), chatId);
        });
    }
    /**
      * Get the details of a group through the invite link
     * @param link This can be an invite link or invite code
     * @returns
     */
    inviteInfo(link) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(link => WAPI.inviteInfo(link), link);
        });
    }
    /**
      * Revokes the current invite link for a group chat. Any previous links will stop working
     * @param chatId
     * @returns `Promise<boolean>`
     */
    revokeGroupInviteLink(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(chatId => WAPI.revokeGroupInviteLink(chatId), chatId);
        });
    }
    /**
     * Deletes message of given message id
     * @param chatId The chat id from which to delete the message.
     * @param messageId The specific message id of the message to be deleted
     * @param onlyLocal If it should only delete locally (message remains on the other recipienct's phone). Defaults to false.
     * @returns nothing
     */
    deleteMessage(chatId, messageId, onlyLocal = false) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId, messageId, onlyLocal }) => WAPI.smartDeleteMessages(chatId, messageId, onlyLocal), { chatId, messageId, onlyLocal });
        });
    }
    /**
     * Checks if a number is a valid WA number
     * @param contactId, you need to include the @c.us at the end.
     */
    checkNumberStatus(contactId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(contactId => WAPI.checkNumberStatus(contactId), contactId);
        });
    }
    /**
     * Retrieves all undread Messages
     * @param includeMe
     * @param includeNotifications
     * @param use_unread_count
     * @returns any
     */
    getUnreadMessages(includeMe, includeNotifications, use_unread_count) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ includeMe, includeNotifications, use_unread_count }) => WAPI.getUnreadMessages(includeMe, includeNotifications, use_unread_count), { includeMe, includeNotifications, use_unread_count });
        });
    }
    /**
     * Retrieves all new Messages. where isNewMsg==true
     * @returns list of messages
     */
    getAllNewMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getAllNewMessages());
        });
    }
    /**
     * Retrieves all unread Messages. where ack==-1
     * @returns list of messages
     */
    getAllUnreadMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getAllUnreadMessages());
        });
    }
    /**
     * Retrieves all unread Messages as indicated by the red dots in WA web. This returns an array of objects and are structured like so:
     * ```javascript
     * [{
     * "id": "000000000000@g.us", //the id of the chat
     * "indicatedNewMessages": [] //array of messages, not including any messages by the host phone
     * }]
     * ```
     * @returns list of messages
     */
    getIndicatedNewMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            return JSON.parse(yield this.pup(() => WAPI.getIndicatedNewMessages()));
        });
    }
    /**
     * Fires all unread messages to the onMessage listener.
     * Make sure to call this AFTER setting your listeners.
     * @returns array of message IDs
     */
    emitUnreadMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.emitUnreadMessages());
        });
    }
    /**
     * Retrieves all Messages in a chat that have been loaded within the WA web instance.
     *
     * This does not load every single message in the chat history.
     *
     * @param chatId, the chat to get the messages from
     * @param includeMe, include my own messages? boolean
     * @param includeNotifications
     * @returns Message[]
     */
    getAllMessagesInChat(chatId, includeMe, includeNotifications) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId, includeMe, includeNotifications }) => WAPI.getAllMessagesInChat(chatId, includeMe, includeNotifications), { chatId, includeMe, includeNotifications });
        });
    }
    /**
     * loads and Retrieves all Messages in a chat
     * @param chatId, the chat to get the messages from
     * @param includeMe, include my own messages? boolean
     * @param includeNotifications
     * @returns any
     */
    loadAndGetAllMessagesInChat(chatId, includeMe, includeNotifications) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId, includeMe, includeNotifications }) => WAPI.loadAndGetAllMessagesInChat(chatId, includeMe, includeNotifications), { chatId, includeMe, includeNotifications });
        });
    }
    /**
     * Create a group and add contacts to it
     *
     * @param groupName group name: 'New group'
     * @param contacts: A single contact id or an array of contact ids.
     */
    createGroup(groupName, contacts) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ groupName, contacts }) => WAPI.createGroup(groupName, contacts), { groupName, contacts });
        });
    }
    /**
     * {@license:insiders@}
     *
     * Create a new community
     *
     * @param communityName The community name
     * @param communitySubject: The community subject line
     * @param icon DataURL of a 1:1 ratio jpeg for the community icon
     * @param existingGroups An array of existing group IDs, that are not already part of a community, to add to this new community.
     * @param newGroups An array of new group objects that
     */
    createCommunity(communityName, communitySubject, icon, existingGroups = [], newGroups) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ communityName, communitySubject, icon, existingGroups, newGroups }) => WAPI.createCommunity(communityName, communitySubject, icon, existingGroups, newGroups), { communityName, communitySubject, icon, existingGroups, newGroups });
        });
    }
    /**
     * Remove participant of Group
     *
     * If not a group chat, returns `NOT_A_GROUP_CHAT`.
     *
     * If the chat does not exist, returns `GROUP_DOES_NOT_EXIST`
     *
     * If the participantId does not exist in the group chat, returns `NOT_A_PARTICIPANT`
     *
     * If the host account is not an administrator, returns `INSUFFICIENT_PERMISSIONS`
     *
     * @param {*} groupId `0000000000-00000000@g.us`
     * @param {*} participantId `000000000000@c.us`
     */
    removeParticipant(groupId, participantId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ groupId, participantId }) => WAPI.removeParticipant(groupId, participantId), { groupId, participantId });
        });
    }
    /** Change the icon for the group chat
     * @param groupId 123123123123_1312313123@g.us The id of the group
     * @param imgData 'data:image/jpeg;base64,...` The base 64 data url. Make sure this is a small img (128x128), otherwise it will fail.
     * @returns boolean true if it was set, false if it didn't work. It usually doesn't work if the image file is too big.
     */
    setGroupIcon(groupId, image) {
        return __awaiter(this, void 0, void 0, function* () {
            const mimeInfo = (0, tools_1.base64MimeType)(image);
            if (!mimeInfo || mimeInfo.includes("image")) {
                let imgData;
                if (this._createConfig.stickerServerEndpoint) {
                    imgData = yield this.stickerServerRequest('convertGroupIcon', {
                        image
                    });
                }
                return yield this.pup(({ groupId, imgData }) => WAPI.setGroupIcon(groupId, imgData), { groupId, imgData });
            }
        });
    }
    /** Change the icon for the group chat
     * @param groupId 123123123123_1312313123@g.us The id of the group
     * @param url'https://upload.wikimedia.org/wikipedia/commons/3/38/JPEG_example_JPG_RIP_001.jpg' The url of the image. Make sure this is a small img (128x128), otherwise it will fail.
     * @param requestConfig {} By default the request is a get request, however you can override that and many other options by sending this parameter. You can read more about this parameter here: https://github.com/axios/axios#request-config
     * @returns boolean true if it was set, false if it didn't work. It usually doesn't work if the image file is too big.
     */
    setGroupIconByUrl(groupId, url, requestConfig = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            // eslint-disable-next-line no-useless-catch
            try {
                const base64 = yield (0, tools_1.getDUrl)(url, requestConfig);
                return yield this.setGroupIcon(groupId, base64);
            }
            catch (error) {
                throw error;
            }
        });
    }
    /**
    * Add participant to Group
    *
    * If not a group chat, returns `NOT_A_GROUP_CHAT`.
    *
    * If the chat does not exist, returns `GROUP_DOES_NOT_EXIST`
    *
    * If the participantId does not exist in the contacts, returns `NOT_A_CONTACT`
    *
    * If the host account is not an administrator, returns `INSUFFICIENT_PERMISSIONS`
    *
    * @param {*} groupId '0000000000-00000000@g.us'
    * @param {*} participantId '000000000000@c.us'
    *
    */
    addParticipant(groupId, participantId) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.pup(({ groupId, participantId }) => WAPI.addParticipant(groupId, participantId), { groupId, participantId });
            if (typeof res === "object")
                throw new errors_1.AddParticipantError('Unable to add some participants', res);
            if (typeof res === "string")
                throw new errors_1.AddParticipantError(res);
            return res;
        });
    }
    /**
    * Promote Participant to Admin in Group
    *
    *
    * If not a group chat, returns `NOT_A_GROUP_CHAT`.
    *
    * If the chat does not exist, returns `GROUP_DOES_NOT_EXIST`
    *
    * If the participantId does not exist in the group chat, returns `NOT_A_PARTICIPANT`
    *
    * If the host account is not an administrator, returns `INSUFFICIENT_PERMISSIONS`
    *
    * @param {*} groupId '0000000000-00000000@g.us'
    * @param {*} participantId '000000000000@c.us'
    */
    promoteParticipant(groupId, participantId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ groupId, participantId }) => WAPI.promoteParticipant(groupId, participantId), { groupId, participantId });
        });
    }
    /**
    * Demote Admin of Group
    *
    * If not a group chat, returns `NOT_A_GROUP_CHAT`.
    *
    * If the chat does not exist, returns `GROUP_DOES_NOT_EXIST`
    *
    * If the participantId does not exist in the group chat, returns `NOT_A_PARTICIPANT`
    *
    * If the host account is not an administrator, returns `INSUFFICIENT_PERMISSIONS`
    *
    * @param {*} groupId '0000000000-00000000@g.us'
    * @param {*} participantId '000000000000@c.us'
    */
    demoteParticipant(groupId, participantId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ groupId, participantId }) => WAPI.demoteParticipant(groupId, participantId), { groupId, participantId });
        });
    }
    /**
    *
    * Change who can and cannot speak in a group
    * @param groupId '0000000000-00000000@g.us' the group id.
    * @param onlyAdmins boolean set to true if you want only admins to be able to speak in this group. false if you want to allow everyone to speak in the group
    * @returns boolean true if action completed successfully.
    */
    setGroupToAdminsOnly(groupId, onlyAdmins) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ groupId, onlyAdmins }) => WAPI.setGroupToAdminsOnly(groupId, onlyAdmins), { groupId, onlyAdmins });
        });
    }
    /**
     *
    * Change who can and cannot edit a groups details
    * @param groupId '0000000000-00000000@g.us' the group id.
    * @param onlyAdmins boolean set to true if you want only admins to be able to speak in this group. false if you want to allow everyone to speak in the group
    * @returns boolean true if action completed successfully.
    */
    setGroupEditToAdminsOnly(groupId, onlyAdmins) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ groupId, onlyAdmins }) => WAPI.setGroupEditToAdminsOnly(groupId, onlyAdmins), { groupId, onlyAdmins });
        });
    }
    /**
    * Change the group chant description
    * @param groupId '0000000000-00000000@g.us' the group id.
    * @param description string The new group description
    * @returns boolean true if action completed successfully.
    */
    setGroupDescription(groupId, description) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ groupId, description }) => WAPI.setGroupDescription(groupId, description), { groupId, description });
        });
    }
    /**
     * {@license:insiders@}
     *
    * Change the group chat title
    * @param groupId '0000000000-00000000@g.us' the group id.
    * @param title string The new group title
    * @returns boolean true if action completed successfully.
    */
    setGroupTitle(groupId, title) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ groupId, title }) => WAPI.setGroupTitle(groupId, title), { groupId, title });
        });
    }
    /**
    * Get Admins of a Group
    * @param {*} groupId '0000000000-00000000@g.us'
    */
    getGroupAdmins(groupId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup((groupId) => WAPI.getGroupAdmins(groupId), groupId);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Set the wallpaper background colour
     * @param {string} hex '#FFF123'
    */
    setChatBackgroundColourHex(hex) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup((hex) => WAPI.setChatBackgroundColourHex(hex), hex);
        });
    }
    /**
     *
     * Start dark mode [NOW GENERALLY AVAILABLE]
     * @param {boolean} activate true to activate dark mode, false to deactivate
    */
    darkMode(activate) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup((activate) => WAPI.darkMode(activate), activate);
        });
    }
    /**
     *
     * Automatically reject calls on the host account device. Please note that the device that is calling you will continue to ring.
     *
     * Update: Due to the nature of MD, the host account will continue ringing.
     *
     * @param message optional message to send to the calling account when their call is detected and rejected
     */
    autoReject(message) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup((message) => WAPI.autoReject(message), message);
        });
    }
    /**
     * Returns an array of contacts that have read the message. If the message does not exist, it will return an empty array. If the host account has disabled read receipts this may not work!
     * Each of these contact objects have a property `t` which represents the time at which that contact read the message.
     * @param messageId The message id
     */
    getMessageReaders(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup((messageId) => WAPI.getMessageReaders(messageId), messageId);
        });
    }
    /**
     * Returns poll data including results and votes.
     *
     * @param messageId The message id of the Poll
     */
    getPollData(messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup((messageId) => WAPI.getPollData(messageId), messageId);
        });
    }
    /**
     * Sends a sticker (including GIF) from a given URL
     * @param to: The recipient id.
     * @param url: The url of the image
     * @param requestConfig {} By default the request is a get request, however you can override that and many other options by sending this parameter. You can read more about this parameter here: https://github.com/axios/axios#request-config
     *
     * @returns `Promise<MessageId | boolean>`
     */
    sendStickerfromUrl(to, url, requestConfig = {}, stickerMetadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const base64 = yield (0, tools_1.getDUrl)(url, requestConfig);
            return yield this.sendImageAsSticker(to, base64, stickerMetadata);
        });
    }
    /**
     * {@license:insiders@}
     *
     * Sends a sticker from a given URL
     * @param to The recipient id.
     * @param url The url of the image
     * @param messageId The id of the message to reply to
     * @param requestConfig {} By default the request is a get request, however you can override that and many other options by sending this parameter. You can read more about this parameter here: https://github.com/axios/axios#request-config
     *
     * @returns `Promise<MessageId | boolean>`
     */
    sendStickerfromUrlAsReply(to, url, messageId, requestConfig = {}, stickerMetadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const dUrl = yield (0, tools_1.getDUrl)(url, requestConfig);
            const processingResponse = yield this.prepareWebp(dUrl, stickerMetadata);
            if (!processingResponse)
                return false;
            const { webpBase64, metadata } = processingResponse;
            return yield this.pup(({ webpBase64, to, metadata, messageId }) => WAPI.sendStickerAsReply(webpBase64, to, metadata, messageId), { webpBase64, to, metadata, messageId });
        });
    }
    /**
     * {@license:insiders@}
     *
     * This function takes an image and sends it as a sticker to the recipient as a reply to another message.
     *
     *
     * @param to  The recipient id.
     * @param image: [[DataURL]], [[Base64]], URL (string GET), Relative filepath (string), or Buffer of the image
     * @param messageId  The id of the message to reply to
     * @param stickerMetadata  Sticker metadata
     */
    sendImageAsStickerAsReply(to, image, messageId, stickerMetadata) {
        return __awaiter(this, void 0, void 0, function* () {
            //@ts-ignore
            if ((Buffer.isBuffer(image) || typeof image === 'object' || (image === null || image === void 0 ? void 0 : image.type) === 'Buffer') && image.toString) {
                image = image.toString('base64');
            }
            else if (typeof image === 'string') {
                if (!(0, tools_1.isDataURL)(image) && !(0, tools_1.isBase64)(image)) {
                    //must be a file then
                    if ((0, is_url_superb_1.default)(image)) {
                        image = yield (0, tools_1.getDUrl)(image);
                    }
                    else {
                        const relativePath = path.join(path.resolve(process.cwd(), image || ''));
                        if (fs.existsSync(image) || fs.existsSync(relativePath)) {
                            image = yield (0, datauri_1.default)(fs.existsSync(image) ? image : relativePath);
                        }
                        else
                            return 'FILE_NOT_FOUND';
                    }
                }
            }
            const processingResponse = yield this.prepareWebp(image, stickerMetadata);
            if (!processingResponse)
                return false;
            const { webpBase64, metadata } = processingResponse;
            return yield this.pup(({ webpBase64, to, metadata, messageId }) => WAPI.sendStickerAsReply(webpBase64, to, metadata, messageId), { webpBase64, to, metadata, messageId });
        });
    }
    /**
     * This allows you to get a single property of a single object from the session. This limints the amouunt of data you need to sift through, reduces congestion between your process and the session and the flexibility to build your own specific getters.
     *
     * Example - get message read state (ack):
     *
     * ```javascript
     * const ack  = await client.getSingleProperty('Msg',"true_12345678912@c.us_9C4D0965EA5C09D591334AB6BDB07FEB",'ack')
     * ```
     * @param namespace
     * @param id id of the object to get from the specific namespace
     * @param property the single property key to get from the object.
     * @returns any If the property or the id cannot be found, it will return a 404
     */
    getSingleProperty(namespace, id, property) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ namespace, id, property }) => WAPI.getSingleProperty(namespace, id, property), { namespace, id, property });
        });
    }
    stickerServerRequest(func, a = {}, fallback = false) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._createConfig.stickerServerEndpoint)
                return false;
            if (func === 'convertMp4BufferToWebpDataUrl')
                fallback = true;
            const sessionInfo = this.getSessionInfo();
            sessionInfo.WA_AUTOMATE_VERSION = sessionInfo.WA_AUTOMATE_VERSION.split(' ')[0];
            if (a.file || a.image || a.emojiId) {
                if (!a.emojiId) {
                    //check if its a local file:
                    const key = a.file ? 'file' : 'image';
                    if (!(0, tools_1.isDataURL)(a[key]) && !(0, is_url_superb_1.default)(a[key]) && !(0, tools_1.isBase64)(a[key])) {
                        const relativePath = path.join(path.resolve(process.cwd(), a[key] || ''));
                        if (fs.existsSync(a[key]) || fs.existsSync(relativePath)) {
                            a[key] = yield (0, datauri_1.default)(fs.existsSync(a[key]) ? a[key] : relativePath);
                        }
                        else {
                            console.error('FILE_NOT_FOUND');
                            throw new errors_1.CustomError(errors_1.ERROR_NAME.FILE_NOT_FOUND, 'FILE NOT FOUND');
                        }
                    }
                    if ((a === null || a === void 0 ? void 0 : a.stickerMetadata) && typeof (a === null || a === void 0 ? void 0 : a.stickerMetadata) !== "object")
                        throw new errors_1.CustomError(errors_1.ERROR_NAME.BAD_STICKER_METADATA, `Received ${typeof (a === null || a === void 0 ? void 0 : a.stickerMetadata)}: ${a === null || a === void 0 ? void 0 : a.stickerMetadata}`);
                }
                if ((_a = this._createConfig) === null || _a === void 0 ? void 0 : _a.discord) {
                    a.stickerMetadata = Object.assign(Object.assign({}, (a.stickerMetadata || {})), { discord: `${((_b = a.stickerMetadata) === null || _b === void 0 ? void 0 : _b.discord) || this._createConfig.discord}` });
                }
                try {
                    const { data } = yield axios_1.default.post(`${((fallback ? pkg.stickerUrl : 'https://sticker-api.openwa.dev') || this._createConfig.stickerServerEndpoint).replace(/\/$/, '')}/${func}`, Object.assign(Object.assign({}, a), { sessionInfo, config: this.getConfig() }), {
                        maxBodyLength: 20000000,
                        maxContentLength: 1500000 // 1.5mb response body limit
                    });
                    return data;
                }
                catch (err) {
                    if (err === null || err === void 0 ? void 0 : err.message.includes("maxContentLength size")) {
                        throw new errors_1.CustomError(errors_1.ERROR_NAME.STICKER_TOO_LARGE, err === null || err === void 0 ? void 0 : err.message);
                    }
                    else if (!fallback) {
                        return yield this.stickerServerRequest(func, a, true);
                    }
                    console.error((_c = err === null || err === void 0 ? void 0 : err.response) === null || _c === void 0 ? void 0 : _c.status, (_d = err === null || err === void 0 ? void 0 : err.response) === null || _d === void 0 ? void 0 : _d.data);
                    throw err;
                    return false;
                }
            }
            else {
                console.error("Media is missing from this request");
                throw new errors_1.CustomError(errors_1.ERROR_NAME.MEDIA_MISSING, "Media is missing from this request");
            }
        });
    }
    prepareWebp(image, stickerMetadata) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((0, tools_1.isDataURL)(image) && !image.includes("image")) {
                console.error("Not an image. Please use convertMp4BufferToWebpDataUrl to process video stickers");
                return false;
            }
            if (this._createConfig.stickerServerEndpoint) {
                return yield this.stickerServerRequest('prepareWebp', {
                    image,
                    stickerMetadata
                });
            }
        });
    }
    /**
     * This function takes an image (including animated GIF) and sends it as a sticker to the recipient. This is helpful for sending semi-ephemeral things like QR codes.
     * The advantage is that it will not show up in the recipients gallery. This function automatiicaly converts images to the required webp format.
     * @param to: The recipient id.
     * @param image: [[DataURL]], [[Base64]], URL (string GET), Relative filepath (string), or Buffer of the image
     */
    sendImageAsSticker(to, image, stickerMetadata) {
        return __awaiter(this, void 0, void 0, function* () {
            //@ts-ignore
            if ((Buffer.isBuffer(image) || typeof image === 'object' || (image === null || image === void 0 ? void 0 : image.type) === 'Buffer') && image.toString) {
                image = image.toString('base64');
            }
            else if (typeof image === 'string') {
                if (!(0, tools_1.isDataURL)(image) && !(0, tools_1.isBase64)(image)) {
                    //must be a file then
                    if ((0, is_url_superb_1.default)(image)) {
                        image = yield (0, tools_1.getDUrl)(image);
                    }
                    else {
                        const relativePath = path.join(path.resolve(process.cwd(), image || ''));
                        if (fs.existsSync(image) || fs.existsSync(relativePath)) {
                            image = yield (0, datauri_1.default)(fs.existsSync(image) ? image : relativePath);
                        }
                        else
                            return 'FILE_NOT_FOUND';
                    }
                }
            }
            const processingResponse = yield this.prepareWebp(image, stickerMetadata);
            if (!processingResponse)
                return false;
            const { webpBase64, metadata } = processingResponse;
            return yield this.pup(({ webpBase64, to, metadata }) => WAPI.sendImageAsSticker(webpBase64, to, metadata), { webpBase64, to, metadata });
        });
    }
    /**
     * Use this to send an mp4 file as a sticker. This can also be used to convert GIFs from the chat because GIFs in WA are actually tiny mp4 files.
     *
     * @param to ChatId The chat id you want to send the webp sticker to
     * @param file [[DataURL]], [[Base64]], URL (string GET), Relative filepath (string), or Buffer of the mp4 file
     * @param messageId message id of the message you want this sticker to reply to. {@license:insiders@}
     */
    sendMp4AsSticker(to, file, processOptions = media_1.defaultProcessOptions, stickerMetadata, messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            //@ts-ignore
            if ((Buffer.isBuffer(file) || typeof file === 'object' || (file === null || file === void 0 ? void 0 : file.type) === 'Buffer') && file.toString) {
                file = file.toString('base64');
            }
            if (typeof file === 'string') {
                if (!(0, tools_1.isDataURL)(file) && !(0, tools_1.isBase64)(file)) {
                    //must be a file then
                    if ((0, is_url_superb_1.default)(file)) {
                        file = yield (0, tools_1.getDUrl)(file);
                    }
                    else {
                        const relativePath = path.join(path.resolve(process.cwd(), file || ''));
                        if (fs.existsSync(file) || fs.existsSync(relativePath)) {
                            file = yield (0, datauri_1.default)(fs.existsSync(file) ? file : relativePath);
                        }
                        else
                            return 'FILE_NOT_FOUND';
                    }
                }
            }
            let convertedStickerDataUrl;
            if (this._createConfig.stickerServerEndpoint) {
                convertedStickerDataUrl = yield this.stickerServerRequest('convertMp4BufferToWebpDataUrl', {
                    file,
                    processOptions,
                    stickerMetadata
                });
            }
            try {
                if (!convertedStickerDataUrl)
                    return false;
                return (yield (messageId && this._createConfig.licenseKey)) ? this.sendRawWebpAsStickerAsReply(to, messageId, convertedStickerDataUrl, true) : this.sendRawWebpAsSticker(to, convertedStickerDataUrl, true);
            }
            catch (error) {
                const msg = 'Stickers have to be less than 1MB. Please lower the fps or shorten the duration using the processOptions parameter: https://open-wa.github.io/wa-automate-nodejs/classes/client.html#sendmp4assticker';
                console.log(msg);
                logging_1.log.warn(msg);
                throw new errors_1.CustomError(errors_1.ERROR_NAME.STICKER_TOO_LARGE, msg);
            }
        });
    }
    /**
     * Send a discord emoji to a chat as a sticker
     *
     * @param to ChatId The chat id you want to send the webp sticker to
     * @param emojiId The discord emoji id without indentifying chars. In discord you would write `:who:`, here use `who`
     * @param messageId message id of the message you want this sticker to reply to. {@license:insiders@}
     */
    sendEmoji(to, emojiId, messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            const webp = yield this.stickerServerRequest('emoji', {
                emojiId
            });
            if (webp) {
                if (messageId)
                    return yield this.sendRawWebpAsStickerAsReply(to, messageId, webp, true);
                return yield this.sendRawWebpAsSticker(to, webp, true);
            }
            return false;
        });
    }
    /**
     * You can use this to send a raw webp file.
     * @param to ChatId The chat id you want to send the webp sticker to
     * @param webpBase64 Base64 The base64 string of the webp file. Not DataURl
     * @param animated Boolean Set to true if the webp is animated. Default `false`
     */
    sendRawWebpAsSticker(to, webpBase64, animated = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const metadata = {
                format: 'webp',
                width: 512,
                height: 512,
                animated,
            };
            webpBase64 = webpBase64.replace(/^data:image\/(png|gif|jpeg|webp|octet-stream);base64,/, '');
            return yield this.pup(({ webpBase64, to, metadata }) => WAPI.sendImageAsSticker(webpBase64, to, metadata), { webpBase64, to, metadata });
        });
    }
    /**
     * {@license:insiders@}
     *
     * You can use this to send a raw webp file.
     * @param to ChatId The chat id you want to send the webp sticker to
     * @param messageId MessageId Message ID of the message to reply to
     * @param webpBase64 Base64 The base64 string of the webp file. Not DataURl
     * @param animated Boolean Set to true if the webp is animated. Default `false`
     */
    sendRawWebpAsStickerAsReply(to, messageId, webpBase64, animated = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const metadata = {
                format: 'webp',
                width: 512,
                height: 512,
                animated,
            };
            webpBase64 = webpBase64.replace(/^data:image\/(png|gif|jpeg|webp);base64,/, '');
            return yield this.pup(({ webpBase64, to, metadata, messageId }) => WAPI.sendStickerAsReply(webpBase64, to, metadata, messageId), { webpBase64, to, metadata, messageId });
        });
    }
    /**
     * {@license:insiders@}
     *
     * Turn the ephemeral setting in a chat to on or off
     * @param chatId The ID of the chat
     * @param ephemeral `true` to turn on the ephemeral setting to 1 day, `false` to turn off the ephemeral setting. Other options: `604800 | 7776000`
     * @returns `Promise<boolean>` true if the setting was set, `false` if the chat does not exist
     */
    setChatEphemeral(chatId, ephemeral) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ chatId, ephemeral }) => WAPI.setChatEphemeral(chatId, ephemeral), { chatId, ephemeral });
        });
    }
    /**
     * Send a giphy GIF as an animated sticker.
     * @param to ChatId
     * @param giphyMediaUrl URL | string This is the giphy media url and has to be in the format `https://media.giphy.com/media/RJKHjCAdsAfQPn03qQ/source.gif` or it can be just the id `RJKHjCAdsAfQPn03qQ`
     */
    sendGiphyAsSticker(to, giphyMediaUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ to, giphyMediaUrl }) => WAPI.sendGiphyAsSticker(to, giphyMediaUrl), { to, giphyMediaUrl });
        });
    }
    /**
     * @deprecated
     *
     * :::danger
     *
     * Status features are broken for now. Please join our discord community for updates.
     *
     * :::
     *
     * [REQUIRES A TEXT STORY LICENSE-KEY](https://gum.co/open-wa)
     *
     * Sends a formatted text story.
     * @param text The text to be displayed in the story
     * @param textRgba The colour of the text in the story in hex format, make sure to add the alpha value also. E.g "#FF00F4F2"
     * @param backgroundRgba  The colour of the background in the story in hex format, make sure to add the alpha value also. E.g "#4FF31FF2"
     * @param font The font of the text to be used in the story. This has to be a number. Each number refers to a specific predetermined font. Here are the fonts you can choose from:
     * 0: Sans Serif
     * 1: Serif
     * 2: [Norican Regular](https://fonts.google.com/specimen/Norican)
     * 3: [Bryndan Write](https://www.dafontfree.net/freefonts-bryndan-write-f160189.htm)
     * 4: [Bebasneue Regular](https://www.dafont.com/bebas-neue.font)
     * 5: [Oswald Heavy](https://www.fontsquirrel.com/fonts/oswald)
     * @returns `Promise<string | boolean>` returns status id if it worked, false if it didn't
     */
    postTextStatus(text, textRgba, backgroundRgba, font) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ text, textRgba, backgroundRgba, font }) => WAPI.postTextStatus(text, textRgba, backgroundRgba, font), { text, textRgba, backgroundRgba, font });
        });
    }
    /**
     * @deprecated
     *
     * :::danger
     *
     * Status features are broken for now. Please join our discord community for updates.
     *
     * :::
     *
     * [REQUIRES AN IMAGE STORY LICENSE-KEY](https://gum.co/open-wa)
     *
     * Posts an image story.
     * @param data data url string `data:[<MIME-type>][;charset=<encoding>][;base64],<data>`
     * @param caption The caption for the story
     * @returns `Promise<string | boolean>` returns status id if it worked, false if it didn't
     */
    postImageStatus(data, caption) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ data, caption }) => WAPI.postImageStatus(data, caption), { data, caption });
        });
    }
    /**
     * @deprecated
     *
     * :::danger
     *
     * Status features are broken for now. Please join our discord community for updates.
     *
     * :::
     *
     * [REQUIRES A VIDEO STORY LICENSE-KEY](https://gum.co/open-wa)
     *
     * Posts a video story.
     * @param data data url string `data:[<MIME-type>][;charset=<encoding>][;base64],<data>`
     * @param caption The caption for the story
     * @returns `Promise<string | boolean>` returns status id if it worked, false if it didn't
     */
    postVideoStatus(data, caption) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ data, caption }) => WAPI.postVideoStatus(data, caption), { data, caption });
        });
    }
    /**
     * {@license:restricted@}
     *
     * Consumes a list of id strings of stories to delete.
     *
     * @param statusesToDelete string [] | string an array of ids of stories to delete.
     * @returns boolean. True if it worked.
     */
    deleteStory(statusesToDelete) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ statusesToDelete }) => WAPI.deleteStatus(statusesToDelete), { statusesToDelete });
        });
    }
    /**
     * @deprecated
     * Alias for deleteStory
     */
    deleteStatus(statusesToDelete) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.deleteStory(statusesToDelete);
        });
    }
    /**
     * {@license:restricted@}
     *
     * Deletes all your existing stories.
     * @returns boolean. True if it worked.
     */
    deleteAllStories() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.deleteAllStatus());
        });
    }
    /**
     * @deprecated
     * Alias for deleteStory
     */
    deleteAllStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.deleteAllStories();
        });
    }
    /**
     * {@license:restricted@}
     *
     * Retrieves all existing stories.
     *
     * Only works with a Story License Key
     */
    getMyStoryArray() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.getMyStatusArray());
        });
    }
    /**
     * @deprecated
     * Alias for deleteStory
     */
    getMyStatusArray() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getMyStoryArray();
        });
    }
    /**
     * {@license:restricted@}
     *
     * Retrieves an array of user ids that have 'read' your story.
     *
     * @param id string The id of the story
     *
     */
    getStoryViewers(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ id }) => WAPI.getStoryViewers(id), { id });
        });
    }
    /**
     * Clears all chats of all messages. This does not delete chats. Please be careful with this as it will remove all messages from whatsapp web and the host device. This feature is great for privacy focussed bots.
     *
     * @param ts number A chat that has had a message after ts (epoch timestamp) will not be cleared.
     *
     */
    clearAllChats(ts) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ ts }) => WAPI.clearAllChats(ts), { ts });
        });
    }
    /**
     * This simple function halves the amount of messages in your session message cache. This does not delete messages off your phone. If over a day you've processed 4000 messages this will possibly result in 4000 messages being present in your session.
     * Calling this method will cut the message cache to 2000 messages, therefore reducing the memory usage of your process.
     * You should use this in conjunction with `getAmountOfLoadedMessages` to intelligently control the session message cache.
     */
    cutMsgCache() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.cutMsgCache());
        });
    }
    /**
     * This simple function halves the amount of chats in your session message cache. This does not delete messages off your phone. If over a day you've processed 4000 messages this will possibly result in 4000 messages being present in your session.
     * Calling this method will cut the message cache as much as possible, reducing the memory usage of your process.
     * You should use this in conjunction with `getAmountOfLoadedMessages` to intelligently control the session message cache.
     */
    cutChatCache() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(() => WAPI.cutChatCache());
        });
    }
    /**
     * Deletes chats from a certain index (default 1000). E.g if this startingFrom param is `100` then all chats from index `100` onwards will be deleted.
     *
     * @param startingFrom the chat index to start from. Please do not set this to anything less than 10 @default: `1000`
     */
    deleteStaleChats(startingFrom) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ startingFrom }) => WAPI.deleteStaleChats(startingFrom), { startingFrom });
        });
    }
    /**
     * Download profile pics from the message object.
     * ```javascript
     *  const filename = `profilepic_${message.from}.jpeg`;
     *  const data = await client.downloadProfilePicFromMessage(message);
     *  const dataUri = `data:image/jpeg;base64,${data}`;
     *  fs.writeFile(filename, mData, 'base64', function(err) {
     *    if (err) {
     *      return console.log(err);
     *    }
     *    console.log('The file was saved!');
     *  });
     * ```
     */
    downloadProfilePicFromMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.downloadFileWithCredentials(message.sender.profilePicThumbObj.imgFull);
        });
    }
    /**
     * Download via the browsers authenticated session via URL.
     * @returns base64 string (non-data url)
     */
    downloadFileWithCredentials(url) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!url)
                throw new errors_1.CustomError(errors_1.ERROR_NAME.MISSING_URL, 'Missing URL');
            return yield this.pup(({ url }) => WAPI.downloadFileWithCredentials(url), { url });
        });
    }
    /**
     *
     * Sets the profile pic of the host number.
     * @param data string data url image string.
     * @returns `Promise<boolean>` success if true
     */
    setProfilePic(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pup(({ data }) => WAPI.setProfilePic(data), { data });
        });
    }
    /**
     * Retreives an array of webhook objects
     */
    listWebhooks() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._registeredWebhooks ? Object.keys(this._registeredWebhooks).map(id => this._registeredWebhooks[id]).map((_a) => {
                var { 
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                requestConfig } = _a, rest = __rest(_a, ["requestConfig"]);
                return rest;
            }) : [];
        });
    }
    /**
     * Removes a webhook.
     *
     * Returns `true` if the webhook was found and removed. `false` if the webhook was not found and therefore could not be removed. This does not unregister any listeners off of other webhooks.
     *
     *
     * @param webhookId The ID of the webhook
     * @retruns boolean
     */
    removeWebhook(webhookId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._registeredWebhooks[webhookId]) {
                delete this._registeredWebhooks[webhookId];
                return true; //`Webhook for ${simpleListener} removed`
            }
            return false; //`Webhook for ${simpleListener} not found`
        });
    }
    /**
     * Update registered events for a specific webhook. This will override all existing events. If you'd like to remove all listeners from a webhook, consider using [[removeWebhook]].
     *
     * In order to update authentication details for a webhook, remove it completely and then reregister it with the correct credentials.
     */
    updateWebhook(webhookId, events) {
        return __awaiter(this, void 0, void 0, function* () {
            if (events === "all")
                events = Object.keys(events_2.SimpleListener).map(eventKey => events_2.SimpleListener[eventKey]);
            if (!Array.isArray(events))
                events = [events];
            const validListeners = yield this._setupWebhooksOnListeners(events);
            if (this._registeredWebhooks[webhookId]) {
                this._registeredWebhooks[webhookId].events = validListeners;
                const _a = this._registeredWebhooks[webhookId], { 
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                requestConfig } = _a, rest = __rest(_a, ["requestConfig"]);
                return rest;
            }
            return false;
        });
    }
    /**
     * The client can now automatically handle webhooks. Use this method to register webhooks.
     *
     * @param event use [[SimpleListener]] enum
     * @param url The webhook url
     * @param requestConfig {} By default the request is a post request, however you can override that and many other options by sending this parameter. You can read more about this parameter here: https://github.com/axios/axios#request-config
     * @param concurrency the amount of concurrent requests to be handled by the built in queue. Default is 5.
     */
    // public async registerWebhook(event: SimpleListener, url: string, requestConfig: AxiosRequestConfig = {}, concurrency: number = 5) {
    //   if(!this._webhookQueue) this._webhookQueue = new PQueue({ concurrency });
    //   if(this[event]){
    //     if(!this._registeredWebhooks) this._registeredWebhooks={};
    //     if(this._registeredWebhooks[event]) {
    //       console.log('webhook already registered');
    //       return false;
    //     }
    //     this._registeredWebhooks[event] = this[event](async _data=>await this._webhookQueue.add(async () => await axios({
    //       method: 'post',
    //       url,
    //       data: {
    //       ts: Date.now(),
    //       event,
    //       data:_data
    //       },
    //       ...requestConfig
    //     })));
    //     return this._registeredWebhooks[event];
    //   }
    //   console.log('Invalid lisetner', event);
    //   return false;
    // }
    _setupWebhooksOnListeners(events) {
        return __awaiter(this, void 0, void 0, function* () {
            if (events === "all")
                events = Object.keys(events_2.SimpleListener).map(eventKey => events_2.SimpleListener[eventKey]);
            if (!Array.isArray(events))
                events = [events];
            if (!this._registeredWebhookListeners)
                this._registeredWebhookListeners = {};
            if (!this._registeredWebhooks)
                this._registeredWebhooks = {};
            const validListeners = [];
            events.map(event => {
                if (!event.startsWith("on"))
                    event = `on${event}`;
                if (this[event]) {
                    validListeners.push(event);
                    if (this._registeredWebhookListeners[event] === undefined) {
                        //set it up
                        this._registeredWebhookListeners[event] = this[event]((_data) => __awaiter(this, void 0, void 0, function* () {
                            return yield this._webhookQueue.add(() => __awaiter(this, void 0, void 0, function* () {
                                return yield Promise.all([
                                    ...Object.keys(this._registeredWebhooks).map(webhookId => this._registeredWebhooks[webhookId]).filter(webhookEntry => webhookEntry.events.includes(event))
                                ].map(({ id, url, requestConfig }) => {
                                    const whStart = (0, tools_1.now)();
                                    return (0, axios_1.default)(Object.assign({ method: 'post', url, data: this.prepEventData(_data, event, { webhook_id: id }) }, requestConfig))
                                        .then(({ status }) => {
                                        const t = ((0, tools_1.now)() - whStart).toFixed(0);
                                        logging_1.log.info("Client Webhook", event, status, t);
                                    })
                                        .catch(err => logging_1.log.error(`CLIENT WEBHOOK ERROR: `, url, err.message));
                                }));
                            }));
                        }), 10000);
                    }
                }
            });
            return validListeners;
        });
    }
    /**
     * The client can now automatically handle webhooks. Use this method to register webhooks.
     *
     * @param url The webhook url
     * @param events An array of [[SimpleListener]] enums or `all` (to register all possible listeners)
     * @param requestConfig {} By default the request is a post request, however you can override that and many other options by sending this parameter. You can read more about this parameter here: https://github.com/axios/axios#request-config
     * @param concurrency the amount of concurrent requests to be handled by the built in queue. Default is 5.
     * @returns A webhook object. This will include a webhook ID and an array of all successfully registered Listeners.
     */
    registerWebhook(url, events, requestConfig = {}, concurrency = 5) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._webhookQueue)
                this._webhookQueue = new p_queue_1.default({ concurrency });
            const validListeners = yield this._setupWebhooksOnListeners(events);
            const id = (0, uuid_1.v4)();
            if (validListeners.length) {
                this._registeredWebhooks[id] = {
                    id,
                    ts: Date.now(),
                    url,
                    events: validListeners,
                    requestConfig
                };
                return this._registeredWebhooks[id];
            }
            console.log('Invalid listener(s)', events);
            logging_1.log.warn('Invalid listener(s)', events);
            return false;
        });
    }
    prepEventData(data, event, extras) {
        const sessionId = this.getSessionId();
        return Object.assign({ ts: Date.now(), sessionId, id: (0, uuid_1.v4)(), event,
            data }, extras);
    }
    getEventSignature(simpleListener) {
        return `${simpleListener || '**'}.${this._createConfig.sessionId || 'session'}.${this._sessionInfo.INSTANCE_ID}`;
    }
    registerEv(simpleListener) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this[simpleListener]) {
                if (!this._registeredEvListeners)
                    this._registeredEvListeners = {};
                if (this._registeredEvListeners[simpleListener]) {
                    console.log('Listener already registered');
                    logging_1.log.warn('Listener already registered');
                    return false;
                }
                this._registeredEvListeners[simpleListener] = yield this[simpleListener](data => events_1.ev.emit(this.getEventSignature(simpleListener), this.prepEventData(data, simpleListener)));
                return true;
            }
            console.log('Invalid lisetner', simpleListener);
            logging_1.log.warn('Invalid lisetner', simpleListener);
            return false;
        });
    }
    /**
     * Every time this is called, it returns one less number. This is used to sort out queue priority.
     */
    tickPriority() {
        this._prio = this._prio - 1;
        return this._prio;
    }
    /**
     * Get the INSTANCE_ID of the current session
     */
    getInstanceId() {
        return this._sessionInfo.INSTANCE_ID;
    }
    /**
     * Returns a new message collector for the chat which is related to the first parameter c
     * @param c The Mesasge/Chat or Chat Id to base this message colletor on
     * @param filter A function that consumes a [Message] and returns a boolean which determines whether or not the message shall be collected.
     * @param options The options for the collector. For example, how long the collector shall run for, how many messages it should collect, how long between messages before timing out, etc.
     */
    createMessageCollector(c, filter, options) {
        var _a;
        const chatId = (((_a = c === null || c === void 0 ? void 0 : c.chat) === null || _a === void 0 ? void 0 : _a.id) || (c === null || c === void 0 ? void 0 : c.id) || c);
        return new MessageCollector_1.MessageCollector(this.getSessionId(), this.getInstanceId(), chatId, filter, options, events_1.ev);
    }
    /**
     * [FROM DISCORDJS]
     * Similar to createMessageCollector but in promise form.
     * Resolves with a collection of messages that pass the specified filter.
     * @param c The Mesasge/Chat or Chat Id to base this message colletor on
     * @param {CollectorFilter} filter The filter function to use
     * @param {AwaitMessagesOptions} [options={}] Optional options to pass to the internal collector
     * @returns {Promise<Collection<string, Message>>}
     * @example
     * ```javascript
     * // Await !vote messages
     * const filter = m => m.body.startsWith('!vote');
     * // Errors: ['time'] treats ending because of the time limit as an error
     * channel.awaitMessages(filter, { max: 4, time: 60000, errors: ['time'] })
     *   .then(collected => console.log(collected.size))
     *   .catch(collected => console.log(`After a minute, only ${collected.size} out of 4 voted.`));
     * ```
     */
    awaitMessages(c, filter, options = {}) {
        return new Promise((resolve, reject) => {
            const collector = this.createMessageCollector(c, filter, options);
            collector.once('end', (collection, reason) => {
                if (options.errors && options.errors.includes(reason)) {
                    reject(collection);
                }
                else {
                    resolve(collection);
                }
            });
        });
    }
}
exports.Client = Client;
var puppeteer_config_2 = require("../config/puppeteer.config");
Object.defineProperty(exports, "useragent", { enumerable: true, get: function () { return puppeteer_config_2.useragent; } });
