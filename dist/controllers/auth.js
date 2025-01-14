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
exports.QRManager = exports.phoneIsOutOfReach = exports.sessionDataInvalid = exports.waitForRipeSession = exports.needsToScan = exports.isAuthenticated = void 0;
const qrcode = __importStar(require("qrcode-terminal"));
const rxjs_1 = require("rxjs");
const events_1 = require("./events");
const initializer_1 = require("./initializer");
const tools_1 = require("../utils/tools");
const browser_1 = require("./browser");
const axios_1 = __importDefault(require("axios"));
const logging_1 = require("../logging/logging");
const boxen_1 = __importDefault(require("boxen"));
/**
 * isAuthenticated
 * Validates if client is authenticated
 * @returns true if is authenticated, false otherwise
 * @param waPage
 */
const isAuthenticated = (waPage) => (0, rxjs_1.race)((0, exports.needsToScan)(waPage), isInsideChat(waPage), (0, exports.sessionDataInvalid)(waPage)).toPromise();
exports.isAuthenticated = isAuthenticated;
const needsToScan = (waPage) => {
    return (0, rxjs_1.from)(new Promise((resolve) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield Promise.race([
                waPage.waitForFunction('checkQrRefresh()', { timeout: 0, polling: 1000 }).catch(() => { }),
                yield waPage
                    .waitForSelector('body > div > div > .landing-wrapper', {
                    timeout: 0
                }).catch(() => resolve(true))
            ]).catch(() => { });
            yield waPage.waitForSelector("canvas[aria-label='Scan me!']", { timeout: 0 }).catch(() => { });
            resolve(false);
        }
        catch (error) {
            console.log("needsToScan -> error", error);
            logging_1.log.error("needsToScan -> error", error);
        }
    })));
};
exports.needsToScan = needsToScan;
const isInsideChat = (waPage) => {
    return (0, rxjs_1.from)(waPage
        .waitForFunction("!!window.WA_AUTHENTICATED || (document.getElementsByClassName('app')[0] && document.getElementsByClassName('app')[0].attributes && !!document.getElementsByClassName('app')[0].attributes.tabindex) || (document.getElementsByClassName('two')[0] && document.getElementsByClassName('two')[0].attributes && !!document.getElementsByClassName('two')[0].attributes.tabindex)", { timeout: 0 })
        .then(() => true));
};
const isTosBlocked = (waPage) => {
    return (0, rxjs_1.from)(waPage
        .waitForFunction(`document.getElementsByTagName("html")[0].classList[0] === 'no-js'`, { timeout: 0 })
        .then(() => false));
};
const waitForRipeSession = (waPage) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield waPage.waitForFunction(`window.isRipeSession()`, { timeout: 0, polling: 'mutation' });
        return true;
    }
    catch (error) {
        return false;
    }
});
exports.waitForRipeSession = waitForRipeSession;
const sessionDataInvalid = (waPage) => __awaiter(void 0, void 0, void 0, function* () {
    const check = `Object.keys(localStorage).includes("old-logout-cred")`;
    yield waPage
        .waitForFunction(check, { timeout: 0, polling: 'mutation' });
    // await injectApi(waPage, null, true);
    // await waPage
    //   .waitForFunction(
    //     '!window.getQrPng',
    //     { timeout: 0, polling: 'mutation' }
    //   )
    // await timeout(1000000)
    //NEED A DIFFERENT WAY TO DETERMINE IF THE SESSION WAS LOGGED OUT!!!!
    //if the code reaches here it means the browser was refreshed. Nuke the session data and restart `create`
    return 'NUKE';
});
exports.sessionDataInvalid = sessionDataInvalid;
const phoneIsOutOfReach = (waPage) => __awaiter(void 0, void 0, void 0, function* () {
    return yield waPage
        .waitForFunction('document.querySelector("body").innerText.includes("Trying to reach phone")', { timeout: 0, polling: 'mutation' })
        .then(() => true)
        .catch(() => false);
});
exports.phoneIsOutOfReach = phoneIsOutOfReach;
class QRManager {
    constructor(config = null) {
        this.qrEv = null;
        this.qrNum = 0;
        this.hash = 'START';
        this.config = null;
        this.firstEmitted = false;
        this._internalQrPngLoaded = false;
        this.qrCheck = `document.querySelector("canvas[aria-label='Scan me!']")?document.querySelector("canvas[aria-label='Scan me!']").parentElement.getAttribute("data-ref"):false`;
        this.config = config;
        this.setConfig(this.config);
    }
    setConfig(config) {
        this.config = config;
        this.qrEvF(this.config);
    }
    qrEvF(config = this.config) {
        // return new EvEmitter(config.sessionId || 'session', 'qr');
        if (!this.qrEv)
            this.qrEv = new events_1.EvEmitter(config.sessionId || 'session', 'qr');
        return this.qrEv;
    }
    grabAndEmit(qrData, waPage, config, spinner) {
        return __awaiter(this, void 0, void 0, function* () {
            this.qrNum++;
            if (config.qrMax && this.qrNum > config.qrMax) {
                spinner.info('QR Code limit reached, exiting...');
                yield (0, browser_1.kill)(waPage, null, true, null, "QR_LIMIT_REACHED");
            }
            const qrEv = this.qrEvF(config);
            if ((!this.qrNum || this.qrNum == 1) && browser_1.BROWSER_START_TS)
                spinner.info(`First QR: ${Date.now() - browser_1.BROWSER_START_TS} ms`);
            if (qrData) {
                qrEv.emit(qrData, `qrData`);
                if (!config.qrLogSkip) {
                    qrcode.generate(qrData, { small: true }, terminalQrCode => {
                        console.log((0, boxen_1.default)(terminalQrCode, { title: config.sessionId, padding: 1, titleAlignment: 'center' }));
                    });
                }
                else {
                    console.log(`New QR Code generated. Not printing in console because qrLogSkip is set to true`);
                    logging_1.log.info(`New QR Code generated. Not printing in console because qrLogSkip is set to true`);
                }
            }
            if (!this._internalQrPngLoaded) {
                logging_1.log.info("Waiting for internal QR renderer to load");
                const t = yield (0, tools_1.timePromise)(() => waPage.waitForFunction(`window.getQrPng || false`, { timeout: 0, polling: 'mutation' }));
                logging_1.log.info(`Internal QR renderer loaded in ${t} ms`);
                this._internalQrPngLoaded = true;
            }
            try {
                const qrPng = yield waPage.evaluate(`window.getQrPng()`);
                if (qrPng) {
                    qrEv.emit(qrPng);
                    (0, tools_1.processSend)('ready');
                    if (config.ezqr) {
                        const host = 'https://qr.openwa.cloud/';
                        yield axios_1.default.post(host, {
                            value: qrPng,
                            hash: this.hash
                        }).then(({ data }) => {
                            if (this.hash === 'START') {
                                const qrUrl = `${host}${data}`;
                                qrEv.emit(qrUrl, `qrUrl`);
                                console.log(`Scan the qr code at ${qrUrl}`);
                                logging_1.log.info(`Scan the qr code at ${qrUrl}`);
                            }
                            this.hash = data;
                        }).catch(e => {
                            this.hash = 'START';
                        });
                    }
                }
                else {
                    spinner.info("Something went wrong while retreiving new the QR code but it should not affect the session launch procedure.");
                }
            }
            catch (error) {
                //@ts-ignore
                const lr = yield waPage.evaluate("window.launchres");
                console.log(lr);
                logging_1.log.info('smartQr -> error', { lr });
                spinner.info(`Something went wrong while retreiving new the QR code but it should not affect the session launch procedure: ${error.message}`);
            }
        });
    }
    smartQr(waPage, config, spinner) {
        return __awaiter(this, void 0, void 0, function* () {
            const evalResult = yield waPage.evaluate("window.Store && window.Store.State");
            if (evalResult === false) {
                console.log('Seems as though you have been TOS_BLOCKed, unable to refresh QR Code. Please see https://github.com/open-wa/wa-automate-nodejs#best-practice for information on how to prevent this from happeing. You will most likely not get a QR Code');
                logging_1.log.warn('Seems as though you have been TOS_BLOCKed, unable to refresh QR Code. Please see https://github.com/open-wa/wa-automate-nodejs#best-practice for information on how to prevent this from happeing. You will most likely not get a QR Code');
                if (config.throwErrorOnTosBlock)
                    throw new Error('TOSBLOCK');
            }
            const isAuthed = yield (0, exports.isAuthenticated)(waPage);
            if (isAuthed)
                return true;
            const _hasDefaultStateYet = yield waPage.evaluate("!!(window.Store &&  window.Store.State && window.Store.State.Socket)");
            if (!_hasDefaultStateYet) {
                //expecting issue, take a screenshot then wait a few seconds before continuing
                yield (0, tools_1.timeout)(2000);
            }
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                const funcName = '_smartQr';
                const md = "MULTI_DEVICE_DETECTED";
                let gotResult = false;
                const fn = (qrData) => __awaiter(this, void 0, void 0, function* () {
                    if (qrData.length > 200 && !(config === null || config === void 0 ? void 0 : config.multiDevice)) {
                        spinner.fail(`Multi-Device detected, please set multiDevice to true in your config or add the --multi-device flag`);
                        spinner.emit(true, "MD_DETECT");
                        return resolve(md);
                    }
                    if (!gotResult && (qrData === 'QR_CODE_SUCCESS' || qrData === md)) {
                        gotResult = true;
                        spinner === null || spinner === void 0 ? void 0 : spinner.succeed("QR code scanned. Loading session...");
                        return resolve(yield isInsideChat(waPage).toPromise());
                    }
                    if (!gotResult)
                        this.grabAndEmit(qrData, waPage, config, spinner);
                });
                const set = () => waPage.evaluate(({ funcName }) => {
                    //@ts-ignore
                    return window['smartQr'] ? window[`smartQr`](obj => window[funcName](obj)) : false;
                }, { funcName });
                yield waPage.exposeFunction(funcName, (obj) => fn(obj)).then(set).catch((e) => __awaiter(this, void 0, void 0, function* () {
                    //if an error occurs during the qr launcher then take a screenshot.
                    yield (0, initializer_1.screenshot)(waPage);
                    console.log("qr -> e", e);
                    logging_1.log.error("qr -> e", e);
                }));
                yield this.emitFirst(waPage, config, spinner);
            }));
        });
    }
    emitFirst(waPage, config, spinner) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.firstEmitted)
                return;
            this.firstEmitted = true;
            const firstQr = yield waPage.evaluate(this.qrCheck);
            yield this.grabAndEmit(firstQr, waPage, config, spinner);
        });
    }
    /**
     * Wait 10 seconds for the qr element to show.
     * If it doesn't show up within 10 seconds then assume the session is authed already or blocked therefore ignore and return promise
     */
    waitFirstQr(waPage, config, spinner) {
        return __awaiter(this, void 0, void 0, function* () {
            const fqr = yield waPage.waitForFunction(`!!(${this.qrCheck})`, {
                polling: 500,
                timeout: 10000
            })
                .catch(() => false);
            if (fqr)
                yield this.emitFirst(waPage, config, spinner);
            return;
        });
    }
}
exports.QRManager = QRManager;
