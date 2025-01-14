import { Observable } from 'rxjs';
import { Spin } from './events';
import { ConfigObject } from '../api/model';
import { Page } from 'puppeteer';
/**
 * isAuthenticated
 * Validates if client is authenticated
 * @returns true if is authenticated, false otherwise
 * @param waPage
 */
export declare const isAuthenticated: (waPage: Page) => Promise<unknown>;
export declare const needsToScan: (waPage: Page) => Observable<unknown>;
export declare const waitForRipeSession: (waPage: Page) => Promise<boolean>;
export declare const sessionDataInvalid: (waPage: Page) => Promise<string>;
export declare const phoneIsOutOfReach: (waPage: Page) => Promise<boolean>;
export declare class QRManager {
    qrEv: any;
    qrNum: number;
    hash: string;
    config: ConfigObject;
    firstEmitted: boolean;
    _internalQrPngLoaded: boolean;
    qrCheck: string;
    constructor(config?: any);
    setConfig(config: any): void;
    qrEvF(config?: ConfigObject): any;
    grabAndEmit(qrData: any, waPage: Page, config: ConfigObject, spinner: Spin): Promise<void>;
    smartQr(waPage: Page, config?: ConfigObject, spinner?: Spin): Promise<boolean | void | string>;
    emitFirst(waPage: Page, config?: ConfigObject, spinner?: Spin): Promise<void>;
    /**
     * Wait 10 seconds for the qr element to show.
     * If it doesn't show up within 10 seconds then assume the session is authed already or blocked therefore ignore and return promise
     */
    waitFirstQr(waPage: Page, config?: ConfigObject, spinner?: Spin): Promise<void>;
}
