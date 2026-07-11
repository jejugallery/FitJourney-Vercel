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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLineFlexMessage = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
admin.initializeApp();
const LINE_CHANNEL_ACCESS_TOKEN = ((_a = functions.config().line) === null || _a === void 0 ? void 0 : _a.channel_access_token) || process.env.LINE_CHANNEL_ACCESS_TOKEN;
exports.sendLineFlexMessage = functions.region('asia-southeast1').https.onCall(async (data, context) => {
    var _a;
    // Check auth
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const { traineeUserId, imageUrl, comment } = data;
    if (!traineeUserId) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with a traineeUserId.");
    }
    // Allow sending even if comment is empty (just image)
    const textMessage = comment ? comment : "เทรนเนอร์ได้ตรวจอาหารของคุณแล้ว";
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        throw new functions.https.HttpsError("failed-precondition", "LINE_CHANNEL_ACCESS_TOKEN is not configured.");
    }
    // Construct Flex Message
    const flexMessage = {
        type: "flex",
        altText: "เทรนเนอร์ตรวจอาหารของคุณแล้ว",
        contents: {
            type: "bubble",
            hero: {
                type: "image",
                url: imageUrl || "https://firebasestorage.googleapis.com/v0/b/fitjourneythailand.appspot.com/o/default-food.png?alt=media",
                size: "full",
                aspectRatio: "20:13",
                aspectMode: "cover",
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "ผลตรวจอาหาร",
                        weight: "bold",
                        size: "xl",
                        color: "#1DB446"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "lg",
                        spacing: "sm",
                        contents: [
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "📝",
                                        color: "#aaaaaa",
                                        size: "sm",
                                        flex: 1
                                    },
                                    {
                                        type: "text",
                                        text: textMessage,
                                        wrap: true,
                                        color: "#666666",
                                        size: "sm",
                                        flex: 5
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
    };
    try {
        const response = await axios_1.default.post("https://api.line.me/v2/bot/message/push", {
            to: traineeUserId,
            messages: [flexMessage]
        }, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
            }
        });
        return { success: true, data: response.data };
    }
    catch (error) {
        console.error("Error sending LINE message:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new functions.https.HttpsError("internal", "Failed to send LINE message.");
    }
});
//# sourceMappingURL=index.js.map