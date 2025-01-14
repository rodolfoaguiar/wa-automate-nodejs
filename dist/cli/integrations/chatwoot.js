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
exports.setupChatwootOutgoingMessageHandler = exports.chatwootMiddleware = exports.chatwoot_webhook_check_event_name = void 0;
const uuid_apikey_1 = __importDefault(require("uuid-apikey"));
const __1 = require("../..");
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const mime_types_1 = __importDefault(require("mime-types"));
const tools_1 = require("../../utils/tools");
const contactReg = {
    //WID : chatwoot contact ID
    "example@c.us": "1"
};
const convoReg = {
    //WID : chatwoot conversation ID
    "example@c.us": "1"
};
const ignoreMap = {
    "example_message_id": true
};
let chatwootClient;
exports.chatwoot_webhook_check_event_name = "cli.integrations.chatwoot.check";
function parseIdAndScore(input) {
    const regex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([1-5])$/;
    const match = regex.exec(input);
    if (match) {
        return {
            id: match[1],
            score: parseInt(match[2], 10)
        };
    }
    else {
        return null;
    }
}
const chatwootMiddleware = (cliConfig, client) => {
    return (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const processMesssage = () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const promises = [];
            const { body } = req;
            if (!body)
                return;
            if (body.event == "conversation_status_changed" && body.status == "resolved") {
                __1.log.info("Trying to send CSAT");
                /**
                 * CSAT requested
                 */
                let basicCsatMsgData = (_a = body.messages) === null || _a === void 0 ? void 0 : _a.find(m => (m === null || m === void 0 ? void 0 : m.content_type) === "input_csat");
                if (!basicCsatMsgData) {
                    /**
                     * CSAT Missing from this webhook. Try to find it by getting all messages and filtering by csat and with a ts of more than the webhook event - 5s (just in case the csat was somehow sent before the convo was "resolved")
                     */
                    const msgs = yield chatwootClient.getAllInboxMessages(body.id);
                    basicCsatMsgData = msgs.find(m => m.content_type === 'input_csat' && m.created_at > (body.timestamp - 5));
                }
                if (!basicCsatMsgData)
                    return;
                const _to = `${(((_b = body === null || body === void 0 ? void 0 : body.custom_attributes) === null || _b === void 0 ? void 0 : _b.wanumber) || (((_d = (_c = body.meta) === null || _c === void 0 ? void 0 : _c.sender) === null || _d === void 0 ? void 0 : _d.phone_number) || "").replace('+', '')).replace('@c.us', '')}@c.us`;
                if (_to)
                    promises.push(chatwootClient.sendCSAT(basicCsatMsgData, _to));
            }
            if (!body.conversation)
                return;
            const contact = (body.conversation.meta.sender.phone_number || "").replace('+', '');
            const to = `${contact}@c.us`;
            const m = body.conversation.messages[0];
            if (body.message_type === "incoming" ||
                body.private ||
                body.event !== "message_created" ||
                !m ||
                !contact)
                return;
            const { attachments, content } = m;
            if (!convoReg[to])
                convoReg[to] = body.conversation.id;
            if ((attachments === null || attachments === void 0 ? void 0 : attachments.length) > 0) {
                //has attachments
                const [firstAttachment, ...restAttachments] = attachments;
                const sendAttachment = (attachment, c) => __awaiter(void 0, void 0, void 0, function* () { return attachment && client.sendImage(to, attachment.data_url, attachment.data_url.substring(attachment.data_url.lastIndexOf('/') + 1), c || '', null, true); });
                //send the text as the caption with the first message only
                promises.push(sendAttachment(firstAttachment, content));
                ((restAttachments || []).map(attachment => sendAttachment(attachment)) || []).map(p => promises.push(p));
            }
            else {
                //no attachments
                if (!content)
                    return;
                /**
                 * Check if this is a location message
                 */
                const locationMatcher = /@(\-*\d*\.*\d*\,\-*\d*\.*\d*)/g;
                const [possLoc, ...restMessage] = content.split(' ');
                const locArr = possLoc.match(locationMatcher);
                if (locArr) {
                    const [lat, lng] = locArr[0].split(',');
                    //grab the location message
                    const loc = restMessage.join(' ') || '';
                    promises.push(client.sendLocation(to, lat, lng, loc));
                }
                else {
                    //not a location message
                    /**
                     * Check for url
                     */
                    const urlregex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
                    if (content.match(urlregex) && content.match(urlregex)[0]) {
                        promises.push(client.sendLinkWithAutoPreview(to, content.match(urlregex)[0], content));
                    }
                    else
                        promises.push(client.sendText(to, content));
                }
            }
            const outgoingMessageIds = yield Promise.all(promises);
            __1.log.info(`Outgoing message IDs: ${JSON.stringify(outgoingMessageIds)}`);
            /**
             * Add these message IDs to the ignore map
             */
            outgoingMessageIds.map(id => ignoreMap[`${id}`] = true);
            return outgoingMessageIds;
        });
        try {
            const processAndSendResult = yield processMesssage();
            res.status(200).send(processAndSendResult);
        }
        catch (error) {
            res.status(400).send(error);
        }
        return;
    });
};
exports.chatwootMiddleware = chatwootMiddleware;
const setupChatwootOutgoingMessageHandler = (cliConfig, client) => __awaiter(void 0, void 0, void 0, function* () {
    chatwootClient = new ChatwootClient(cliConfig, client);
    yield chatwootClient.init();
    return;
});
exports.setupChatwootOutgoingMessageHandler = setupChatwootOutgoingMessageHandler;
class ChatwootClient {
    constructor(cliConfig, client) {
        const u = cliConfig.chatwootUrl; //e.g `"localhost:3000/api/v1/accounts/3"
        this.api_access_token = cliConfig.chatwootApiAccessToken;
        const _u = new URL(u);
        this.origin = _u.origin;
        this.port = Number(_u.port || 80);
        this.client = client;
        this.expectedSelfWebhookUrl = cliConfig.apiHost ? `${cliConfig.apiHost}/chatwoot ` : `${cliConfig.host.includes('http') ? '' : `http${cliConfig.https || (cliConfig.cert && cliConfig.privkey) ? 's' : ''}://`}${cliConfig.host}:${cliConfig.port}/chatwoot `;
        this.expectedSelfWebhookUrl = this.expectedSelfWebhookUrl.trim();
        this.key = cliConfig.key;
        if (cliConfig.key)
            this.expectedSelfWebhookUrl = `${this.expectedSelfWebhookUrl}?api_key=${cliConfig.key}`;
        const [accountId, inboxId] = (u.match(/\/(app|(api\/v1))\/accounts\/\d*(\/(inbox|inboxes)\/\d*)?/g) || [''])[0].split('/').filter(Number);
        this.inboxId = inboxId || u.match(/inboxes\/\d*/g) && u.match(/inboxes\/\d*/g)[0].replace('inboxes/', '');
        this.accountId = accountId;
        this.forceUpdateCwWebhook = cliConfig.forceUpdateCwWebhook;
    }
    cwReq(method, path, data, _headers) {
        return __awaiter(this, void 0, void 0, function* () {
            const { origin, accountId, api_access_token } = this;
            const url = `${origin}/api/v1/accounts/${accountId}/${path}`.replace('app.bentonow.com', 'chat.bentonow.com');
            const response = yield (0, axios_1.default)({
                method,
                data,
                url,
                headers: Object.assign({ api_access_token }, _headers)
            }).catch(error => {
                var _a, _b;
                __1.log.error(`CW REQ ERROR: ${(_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status} ${(_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.message}`, error === null || error === void 0 ? void 0 : error.toJSON());
                throw error;
            });
            __1.log.info(`CW REQUEST: ${response.status} ${method} ${url} ${JSON.stringify(data)}`);
            return response;
        });
    }
    /**
     * Ensures the chatwoot integration is setup properly.
     */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            __1.log.info(`Setting up chatwoot integration: ${this.u}`);
            const accountNumber = this.accountNumber = yield this.client.getHostNumber();
            const { api_access_token, origin } = this;
            let { inboxId, accountId } = this;
            const proms = [];
            // const accountId = u.match(/accounts\/\d*/g) && u.match(/accounts\/\d*/g)[0].replace('accounts/', '')
            /**
             * Is the inbox and or account id undefined??
             */
            if (!accountId) {
                __1.log.info(`CHATWOOT INTEGRATION: account ID missing. Attempting to infer from access token....`);
                /**
                 * If the account ID is undefined then get the account ID from the access_token
                 */
                accountId = (yield axios_1.default.get(`${origin}/api/v1/profile`, { headers: { api_access_token } })).data.account_id;
                __1.log.info(`CHATWOOT INTEGRATION: Got account ID: ${accountId}`);
                this.accountId = accountId;
            }
            if (!inboxId) {
                __1.log.info(`CHATWOOT INTEGRATION: inbox ID missing. Attempting to find correct inbox....`);
                /**
                 * Find the inbox with the correct setup.
                 */
                const inboxArray = (yield axios_1.default.get(`${origin}/api/v1/accounts/${accountId}/inboxes`, { headers: { api_access_token } })).data.payload;
                const possibleInbox = inboxArray.find(inbox => { var _a; return ((_a = inbox === null || inbox === void 0 ? void 0 : inbox.additional_attributes) === null || _a === void 0 ? void 0 : _a.hostAccountNumber) === accountNumber; });
                if (possibleInbox) {
                    __1.log.info(`CHATWOOT INTEGRATION: found inbox: ${JSON.stringify(possibleInbox)}`);
                    __1.log.info(`CHATWOOT INTEGRATION: found inbox id: ${possibleInbox.id}`);
                    inboxId = possibleInbox.id;
                    this.inboxId = inboxId;
                }
                else {
                    __1.log.info(`CHATWOOT INTEGRATION: inbox not found. Attempting to create inbox....`);
                    /**
                     * Create inbox
                     */
                    const { data: new_inbox } = (yield axios_1.default.post(`${origin}/api/v1/accounts/${accountId}/inboxes`, {
                        "name": `open-wa-${accountNumber}`,
                        "channel": {
                            "phone_number": `${accountNumber}`,
                            "type": "api",
                            "webhook_url": this.expectedSelfWebhookUrl,
                            "additional_attributes": {
                                "sessionId": this.client.getSessionId(),
                                "hostAccountNumber": `${accountNumber}`
                            }
                        }
                    }, { headers: { api_access_token } }));
                    inboxId = new_inbox.id;
                    __1.log.info(`CHATWOOT INTEGRATION: inbox created. id: ${inboxId}`);
                    this.inboxId = inboxId;
                }
            }
            let { data: get_inbox } = yield this.cwReq('get', `inboxes/${inboxId}`);
            /**
             * Update the webhook
             */
            const updatePayload = {
                "channel": {
                    "additional_attributes": {
                        "sessionId": this.client.getSessionId(),
                        "hostAccountNumber": `${this.accountNumber}`,
                        "instanceId": `${this.client.getInstanceId()}`
                    }
                }
            };
            if (this.forceUpdateCwWebhook)
                updatePayload.channel['webhook_url'] = this.expectedSelfWebhookUrl;
            const updateInboxPromise = this.cwReq('patch', `inboxes/${this.inboxId}`, updatePayload);
            if (this.forceUpdateCwWebhook)
                get_inbox = (yield updateInboxPromise).data;
            else
                proms.push(updateInboxPromise);
            /**
             * Get the inbox and test it.
             */
            if (!((get_inbox === null || get_inbox === void 0 ? void 0 : get_inbox.webhook_url) || "").includes("/chatwoot"))
                console.log("Please set the chatwoot inbox webhook to this sessions URL with path /chatwoot");
            /**
             * Check the webhook URL
             */
            const chatwootWebhookCheck = () => __awaiter(this, void 0, void 0, function* () {
                let checkCodePromise;
                const cancelCheckProm = () => (checkCodePromise.cancel && typeof checkCodePromise.cancel === "function") && checkCodePromise.cancel();
                try {
                    const wUrl = get_inbox.webhook_url.split('?')[0].replace(/\/+$/, "").trim();
                    const checkWhURL = `${wUrl}${wUrl.endsWith("/") ? '' : `/`}checkWebhook${this.key ? `?api_key=${this.key}` : ''}`;
                    __1.log.info(`Verifying webhook url: ${checkWhURL}`);
                    const checkCode = uuid_apikey_1.default.create().apiKey; //random generated string
                    yield new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        checkCodePromise = __1.ev.waitFor(exports.chatwoot_webhook_check_event_name, 5000).catch(reject);
                        yield axios_1.default.post(checkWhURL, {
                            checkCode
                        }, { headers: { api_key: this.key || '' } }).catch(reject);
                        const checkCodeResponse = yield checkCodePromise;
                        if (checkCodeResponse && ((_a = checkCodeResponse[0]) === null || _a === void 0 ? void 0 : _a.checkCode) == checkCode)
                            resolve(true);
                        else
                            reject(`Webhook check code is incorrect. Expected ${checkCode} - incoming ${((checkCodeResponse || [])[0] || {}).checkCode}`);
                    }));
                    __1.log.info('Chatwoot webhook verification successful');
                }
                catch (error) {
                    cancelCheckProm();
                    const e = `Unable to verify the chatwoot webhook URL on this inbox: ${error.message}`;
                    console.error(e);
                    __1.log.error(e);
                }
                finally {
                    cancelCheckProm();
                }
            });
            proms.push(chatwootWebhookCheck());
            const setOnMessageProm = this.client.onMessage(this.processWAMessage.bind(this));
            const setOnAckProm = this.client.onAck((ackEvent) => __awaiter(this, void 0, void 0, function* () {
                if (ignoreMap[ackEvent.id] && typeof ignoreMap[ackEvent.id] === 'number' && ackEvent.ack > ignoreMap[ackEvent.id]) {
                    // delete ignoreMap[ackEvent.id]
                    return;
                }
                if (ackEvent.ack >= 1 && ackEvent.isNewMsg && ackEvent.self === "in") {
                    if (ignoreMap[ackEvent.id])
                        return;
                    ignoreMap[ackEvent.id] = ackEvent.ack;
                    const _message = yield this.client.getMessageById(ackEvent.id);
                    return yield this.processWAMessage(_message);
                }
                return;
            }));
            proms.push(setOnMessageProm);
            proms.push(setOnAckProm);
            yield Promise.all(proms);
            this.inboxId = inboxId;
            this.accountId = accountId;
        });
    }
    getAllInboxMessages(convoIdOrContactId) {
        return __awaiter(this, void 0, void 0, function* () {
            /**
             * Check if it's a contact by traversing the convo reg.
             */
            const convoId = convoReg[convoIdOrContactId] || convoIdOrContactId;
            const { data } = yield this.cwReq('get', `conversations/${convoId}/messages`);
            const messages = data.payload;
            return messages;
        });
    }
    /**
     * Get the original chatwoot message object. Useful for getting CSAT full message details.
     *
     * @param convoIdOrContactId the owa contact ID or the convo ID. Better if you use convo ID.
     * @param messageId
     * @returns
     */
    getMessageObject(convoIdOrContactId, messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            const msgs = yield this.getAllInboxMessages(`${convoIdOrContactId}`);
            const foundMsg = msgs.find(x => x.id == messageId);
            return foundMsg;
        });
    }
    /**
     * Get Contacts and conversations
     */
    searchContact(number) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const n = number.replace('@c.us', '');
                const { data } = yield this.cwReq('get', `contacts/search?q=${n}&sort=phone_number`);
                if (data.payload.length) {
                    return data.payload.find(x => (x.phone_number || "").includes(n)) || false;
                }
                else
                    false;
            }
            catch (error) {
                return;
            }
        });
    }
    getContactConversation(number) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { data } = yield this.cwReq('get', `contacts/${contactReg[number]}/conversations`);
                const allContactConversations = data.payload.filter(c => `${c.inbox_id}` == `${this.inboxId}`).sort((a, b) => a.id - b.id);
                const [opened, notOpen] = [allContactConversations.filter(c => c.status === 'open'), allContactConversations.filter(c => c.status != 'open')];
                const hasOpenConvo = opened[0] ? true : false;
                const resolvedConversation = opened[0] || notOpen[0];
                if (!hasOpenConvo) {
                    //reopen convo
                    yield this.openConversation(resolvedConversation.id);
                }
                return resolvedConversation;
            }
            catch (error) {
                return;
            }
        });
    }
    createConversation(contact_id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { data } = yield this.cwReq('post', `conversations`, {
                    contact_id,
                    "inbox_id": this.inboxId
                });
                return data;
            }
            catch (error) {
                return;
            }
        });
    }
    createContact(contact) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { data } = yield this.cwReq('post', `contacts`, {
                    "identifier": contact.id,
                    "name": contact.formattedName || contact.id,
                    "phone_number": `+${contact.id.replace('@c.us', '')}`,
                    "avatar_url": contact.profilePicThumbObj.eurl,
                    "custom_attributes": Object.assign({ "wa:number": `${contact.id.replace('@c.us', '')}` }, contact)
                });
                return data.payload.contact;
            }
            catch (error) {
                return;
            }
        });
    }
    openConversation(conversationId, status = "opened") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { data } = yield this.cwReq('post', `conversations/${conversationId}/messages`, {
                    status
                });
                return data;
            }
            catch (error) {
                return;
            }
        });
    }
    sendConversationMessage(content, contactId, message) {
        return __awaiter(this, void 0, void 0, function* () {
            __1.log.info(`WA=>CW ${contactId}: ${content} ${message.id}`);
            try {
                const { data } = yield this.cwReq('post', `conversations/${convoReg[contactId]}/messages`, {
                    content,
                    "message_type": message.fromMe ? "outgoing" : "incoming",
                    "private": false,
                    echo_id: message.id
                });
                return data;
            }
            catch (error) {
                return;
            }
        });
    }
    sendAttachmentMessage(content, contactId, message) {
        return __awaiter(this, void 0, void 0, function* () {
            // decrypt message
            const file = yield this.client.decryptMedia(message);
            __1.log.info(`INCOMING MESSAGE ATTACHMENT ${contactId}: ${content} ${message.id}`);
            const formData = new form_data_1.default();
            formData.append('attachments[]', Buffer.from(file.split(',')[1], 'base64'), {
                knownLength: 1,
                filename: `${message.t}.${mime_types_1.default.extension(message.mimetype)}`,
                contentType: (file.match(/[^:\s*]\w+\/[\w-+\d.]+(?=[;| ])/) || ["application/octet-stream"])[0]
            });
            formData.append('content', content);
            formData.append('message_type', 'incoming');
            try {
                const { data } = yield this.cwReq('post', `conversations/${convoReg[contactId]}/messages`, formData, formData.getHeaders());
                return data;
            }
            catch (error) {
                return;
            }
        });
    }
    processWAMessage(message) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let isNewConversation = false;
            if (message.chatId.includes('g')) {
                //chatwoot integration does not support group chats
                return;
            }
            /**
             * Does the contact exist in chatwoot?
             */
            if (!contactReg[message.chatId]) {
                const contact = yield this.searchContact(message.chatId);
                if (contact) {
                    contactReg[message.chatId] = contact.id;
                }
                else {
                    //create the contact
                    contactReg[message.chatId] = (yield this.createContact(message.sender)).id;
                }
            }
            if (!convoReg[message.chatId]) {
                const conversation = yield this.getContactConversation(message.chatId);
                if (conversation) {
                    convoReg[message.chatId] = conversation.id;
                }
                else {
                    //create the conversation
                    convoReg[message.chatId] = (yield this.createConversation(contactReg[message.chatId])).id;
                    isNewConversation = convoReg[message.chatId];
                }
            }
            /**
             * Does the conversation exist in
             */
            let text = message.body;
            let hasAttachments = false;
            switch (message.type) {
                case 'list_response':
                    /**
                     * Possible CSAT response:
                     */
                    yield this.processCSATResponse(message);
                    break;
                case 'location':
                    text = `Location Message:\n\n${message.loc}\n\nhttps://www.google.com/maps?q=${message.lat},${message.lng}`;
                    break;
                case 'buttons_response':
                    text = message.selectedButtonId;
                    break;
                case 'document':
                case 'image':
                case 'audio':
                case 'ptt':
                case 'video':
                    if (message.cloudUrl) {
                        text = `FILE:\t${message.cloudUrl}\n\nMESSAGE:\t${message.text}`;
                    }
                    else {
                        text = message.text;
                        hasAttachments = true;
                    }
                    break;
                default:
                    text = ((_a = message === null || message === void 0 ? void 0 : message.ctwaContext) === null || _a === void 0 ? void 0 : _a.sourceUrl) ? `${message.body}\n\n${message.ctwaContext.sourceUrl}` : message.body || "__UNHANDLED__";
                    break;
            }
            const newCWMessage = hasAttachments ? yield this.sendAttachmentMessage(text, message.chatId, message) : yield this.sendConversationMessage(text, message.chatId, message);
            if (isNewConversation !== false) {
                /**
                 * Wait 3 seconds before trying to check for an automated message
                */
                yield (0, tools_1.timeout)(3000);
                /**
                 * Check the messages to see if a message_type: 3 comes through after the initial message;
                 */
                const msgs = yield this.getAllInboxMessages(`${isNewConversation}`);
                if (!msgs)
                    return;
                /**
                 * Message IDs are numbers (for now)
                 */
                const possibleWelcomeMessage = msgs.filter(m => m.id > newCWMessage.id).find(m => m.message_type === 3 && m.content_type !== 'input_csat');
                if (!possibleWelcomeMessage)
                    return;
                /**
                 * Ok reply with the welcome message now
                 */
                yield this.client.sendText(message.chatId, possibleWelcomeMessage.content || "...");
            }
        });
    }
    processCSATResponse(message) {
        return __awaiter(this, void 0, void 0, function* () {
            const csatResponse = parseIdAndScore(message.listResponse.rowId);
            if (!csatResponse)
                return;
            if (csatResponse.id && csatResponse.score) {
                __1.log.info(`CW:CSAT RESPONSE: ${csatResponse.id} ${csatResponse.score}`);
                /**
                 * PUT request to report CSAT response
                 */
                yield axios_1.default.put(`https://app.chatwoot.com/public/api/v1/csat_survey/${csatResponse.id}`, {
                    "message": {
                        "submitted_values": {
                            "csat_survey_response": {
                                "rating": csatResponse.score
                            }
                        }
                    }
                }).catch(e => { });
            }
        });
    }
    sendCSAT(incomlpeteCsatMessage, to) {
        return __awaiter(this, void 0, void 0, function* () {
            const extractCsatLink = str => (str.match(/(http|ftp|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])/gi) || [])[0];
            /**
             * First check if the given csat message object has the link, if not, get the whole csat object
             */
            let csatMessage;
            if (!extractCsatLink(incomlpeteCsatMessage === null || incomlpeteCsatMessage === void 0 ? void 0 : incomlpeteCsatMessage.content)) {
                csatMessage = yield chatwootClient.getMessageObject(incomlpeteCsatMessage.conversation_id, incomlpeteCsatMessage.id);
            }
            else {
                csatMessage = incomlpeteCsatMessage;
            }
            if (!csatMessage)
                return;
            const lic = false; //this.client.getLicenseType()
            const link = extractCsatLink(csatMessage.content);
            const u = new URL(link);
            const csatID = u.pathname.replace('/survey/responses/', '');
            __1.log.info(`SENDING CSAT ${to} ${csatMessage.content}`);
            if (!lic) {
                /**
                 * Send as a normal text message with the link
                 */
                yield this.client.sendLinkWithAutoPreview(to, link, csatMessage.content);
            }
            else {
                yield this.client.sendListMessage(to, [
                    {
                        title: "Please rate from 1 - 5",
                        rows: [
                            {
                                "title": "😞",
                                "description": "1",
                                rowId: `${csatID}:1`
                            },
                            {
                                "title": "😑",
                                "description": "2",
                                rowId: `${csatID}:2`
                            },
                            {
                                "title": "😐",
                                "description": "3",
                                rowId: `${csatID}:3`
                            },
                            {
                                "title": "😀",
                                "description": "4",
                                rowId: `${csatID}:4`
                            },
                            {
                                "title": "😍",
                                "description": "5",
                                rowId: `${csatID}:5`
                            }
                        ]
                    }
                ], "Customer Survey", "Please rate this conversation", 'Help Us Improve');
            }
        });
    }
}
