"use strict";
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
exports.PREPROCESSORS = exports.MessagePreprocessors = void 0;
const mime_1 = __importDefault(require("mime"));
const fs_extra_1 = require("fs-extra");
const config_1 = require("../api/model/config");
const p_queue_1 = __importDefault(require("p-queue"));
const pico_s3_1 = require("pico-s3");
const processedFiles = {};
let uploadQueue;
const SCRUB = (message) => __awaiter(void 0, void 0, void 0, function* () {
    if (message.deprecatedMms3Url && message.mimetype)
        return Object.assign(Object.assign({}, message), { content: "", body: "" });
    return message;
});
const BODY_ONLY = (message) => __awaiter(void 0, void 0, void 0, function* () {
    if (message.deprecatedMms3Url && message.mimetype)
        return Object.assign(Object.assign({}, message), { content: "" });
    return message;
});
const AUTO_DECRYPT = (message, client) => __awaiter(void 0, void 0, void 0, function* () {
    if (message.deprecatedMms3Url && message.mimetype)
        return Object.assign(Object.assign({}, message), { body: yield client.decryptMedia(message) });
    return message;
});
const AUTO_DECRYPT_SAVE = (message, client) => __awaiter(void 0, void 0, void 0, function* () {
    if (message.deprecatedMms3Url && message.mimetype) {
        const filename = `${message.mId}.${mime_1.default.getExtension(message.mimetype)}`;
        const filePath = `media/${filename}`;
        try {
            const mediaData = yield client.decryptMedia(message);
            (0, fs_extra_1.outputFileSync)(filePath, Buffer.from(mediaData.split(",")[1], "base64"));
        }
        catch (error) {
            console.error(error);
            return message;
        }
        return Object.assign(Object.assign({}, message), { body: filename, content: "", filePath });
    }
    return message;
});
const UPLOAD_CLOUD = (message, client) => __awaiter(void 0, void 0, void 0, function* () {
    if ((message === null || message === void 0 ? void 0 : message.deprecatedMms3Url) && message.mimetype) {
        const { cloudUploadOptions } = client.getConfig();
        if (message.fromMe && (cloudUploadOptions.ignoreHostAccount || process.env.OW_CLOUD_IGNORE_HOST))
            return message;
        if (!uploadQueue) {
            uploadQueue = new p_queue_1.default({ concurrency: 2, interval: 1000, carryoverConcurrencyCount: true, intervalCap: 2 });
        }
        const filename = `${message.mId || `${Date.now()}`}.${mime_1.default.getExtension(message.mimetype)}`;
        const mediaData = yield client.decryptMedia(message);
        if (!cloudUploadOptions)
            return message;
        const provider = (process.env.OW_CLOUD_PROVIDER || cloudUploadOptions.provider);
        const opts = {
            file: mediaData,
            filename,
            provider,
            accessKeyId: process.env.OW_CLOUD_ACCESS_KEY_ID || cloudUploadOptions.accessKeyId,
            secretAccessKey: process.env.OW_CLOUD_SECRET_ACCESS_KEY || cloudUploadOptions.secretAccessKey,
            bucket: process.env.OW_CLOUD_BUCKET || cloudUploadOptions.bucket,
            region: process.env.OW_CLOUD_REGION || cloudUploadOptions.region,
            public: process.env.OW_CLOUD_PUBLIC && true || cloudUploadOptions.public,
            headers: cloudUploadOptions.headers,
        };
        const dirStrat = process.env.OW_DIRECTORY || cloudUploadOptions.directory;
        if (dirStrat) {
            let directory = '';
            switch (dirStrat) {
                case config_1.DIRECTORY_STRATEGY.DATE:
                    directory = `${new Date().toISOString().slice(0, 10)}`;
                    break;
                case config_1.DIRECTORY_STRATEGY.CHAT:
                    directory = `${message.from.replace("@c.us", "").replace("@g.us", "")}`;
                    break;
                case config_1.DIRECTORY_STRATEGY.DATE_CHAT:
                    directory = `${new Date().toISOString().slice(0, 10)}/${message.from.replace("@c.us", "").replace("@g.us", "")}`;
                    break;
                case config_1.DIRECTORY_STRATEGY.CHAT_DATE:
                    directory = `${message.from.replace("@c.us", "").replace("@g.us", "")}/${new Date().toISOString().slice(0, 10)}`;
                    break;
                default:
                    directory = dirStrat;
                    break;
            }
            opts.directory = directory;
        }
        if (!opts.accessKeyId) {
            console.error("UPLOAD ERROR: No accessKeyId provided. If you're using the CLI, set env var OW_CLOUD_ACCESS_KEY_ID");
            return message;
        }
        if (!opts.secretAccessKey) {
            console.error("UPLOAD ERROR: No secretAccessKey provided. If you're using the CLI, set env var OW_CLOUD_SECRET_ACCESS_KEY");
            return message;
        }
        if (!opts.bucket) {
            console.error("UPLOAD ERROR: No bucket provided. If you're using the CLI, set env var OW_CLOUD_BUCKET");
            return message;
        }
        if (!opts.provider) {
            console.error("UPLOAD ERROR: No provider provided. If you're using the CLI, set env var OW_CLOUD_PROVIDER");
            return message;
        }
        const url = (0, pico_s3_1.getCloudUrl)(opts);
        if (!processedFiles[filename]) {
            processedFiles[filename] = true;
            try {
                yield uploadQueue.add(() => (0, pico_s3_1.upload)(opts).catch(() => { }));
            }
            catch (error) {
                console.error(error);
                return message;
            }
        }
        return Object.assign(Object.assign({}, message), { cloudUrl: url });
    }
    return message;
});
/**
 * An object that contains all available [[PREPROCESSORS]].
 *
 * [Check out the processor code here](https://github.com/open-wa/wa-automate-nodejs/blob/master/src/structures/preProcessors.ts)
 */
exports.MessagePreprocessors = {
    AUTO_DECRYPT_SAVE,
    AUTO_DECRYPT,
    BODY_ONLY,
    SCRUB,
    UPLOAD_CLOUD
};
/**
 * A set of easy to use, built-in message processors.
 *
 * [Check out the processor code here](https://github.com/open-wa/wa-automate-nodejs/blob/master/src/structures/preProcessors.ts)
 *
 */
var PREPROCESSORS;
(function (PREPROCESSORS) {
    /**
     * This preprocessor scrubs `body` and `content` from media messages.
     * This would be useful if you want to reduce the message object size because neither of these values represent the actual file, only the thumbnail.
     */
    PREPROCESSORS["SCRUB"] = "SCRUB";
    /**
     * A preprocessor that limits the amount of base64 data is present in the message object by removing duplication of `body` in `content` by replacing `content` with `""`.
     */
    PREPROCESSORS["BODY_ONLY"] = "BODY_ONLY";
    /**
     * Replaces the media thumbnail base64 in `body` with the actual file's DataURL.
     */
    PREPROCESSORS["AUTO_DECRYPT"] = "AUTO_DECRYPT";
    /**
     * Automatically saves the file in a folder named `/media` relative to the process working directory.
     *
     * PLEASE NOTE, YOU WILL NEED TO MANUALLY CLEAR THIS FOLDER!!!
     */
    PREPROCESSORS["AUTO_DECRYPT_SAVE"] = "AUTO_DECRYPT_SAVE";
    /**
     *
     * Uploads file to a cloud storage provider (GCP/AWS for now).
     *
     * If this preprocessor is set then you have to also set [`cloudUploadOptions`](https://docs.openwa.dev/interfaces/api_model_config.ConfigObject.html#cloudUploadOptions) in the config.
     *
     */
    PREPROCESSORS["UPLOAD_CLOUD"] = "UPLOAD_CLOUD";
})(PREPROCESSORS = exports.PREPROCESSORS || (exports.PREPROCESSORS = {}));
