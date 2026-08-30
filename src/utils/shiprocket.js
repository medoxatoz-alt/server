"use strict";
// src/utils/shiprocket.ts — Shiprocket API helper with token caching
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShiprocketShipment = createShiprocketShipment;
exports.cancelShiprocketOrder = cancelShiprocketOrder;
var axios_1 = __importDefault(require("axios"));
var SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';
// ── In-memory token cache (valid for 9 days to be safe; tokens last 10 days) ──
var cachedToken = null;
var tokenExpiresAt = 0;
var TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // 9 days
function getToken() {
    return __awaiter(this, void 0, void 0, function () {
        var now, email, password, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = Date.now();
                    if (cachedToken && now < tokenExpiresAt) {
                        return [2 /*return*/, cachedToken];
                    }
                    email = process.env.SHIPROCKET_EMAIL;
                    password = process.env.SHIPROCKET_PASSWORD;
                    if (!email || !password) {
                        throw new Error('Shiprocket credentials not configured in environment variables.');
                    }
                    return [4 /*yield*/, axios_1.default.post("".concat(SHIPROCKET_BASE, "/auth/login"), { email: email, password: password })];
                case 1:
                    data = (_a.sent()).data;
                    if (!data.token) {
                        throw new Error('Shiprocket authentication failed: no token returned.');
                    }
                    cachedToken = data.token;
                    tokenExpiresAt = now + TOKEN_TTL_MS;
                    return [2 /*return*/, cachedToken];
            }
        });
    });
}
function authHeaders(token) {
    return { Authorization: "Bearer ".concat(token), 'Content-Type': 'application/json' };
}
// ── Create Shiprocket order + assign AWB ──────────────────────────────────────
function createShiprocketShipment(order) {
    return __awaiter(this, void 0, void 0, function () {
        var token, s, orderPayload, createRes, shiprocketOrderId, shiprocketShipmentId, awbRes, awbData, awbCode, courierName, trackingLink;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, getToken()];
                case 1:
                    token = _c.sent();
                    s = order.shippingDetails;
                    orderPayload = {
                        order_id: order.orderId,
                        order_date: order.createdAt.substring(0, 10), // YYYY-MM-DD
                        pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
                        billing_customer_name: s.fullName,
                        billing_last_name: '',
                        billing_address: s.address,
                        billing_city: s.city,
                        billing_pincode: s.pincode,
                        billing_state: s.state,
                        billing_country: 'India',
                        billing_email: s.email || order.customerEmail,
                        billing_phone: s.phone,
                        shipping_is_billing: true,
                        order_items: order.items.map(function (i) { return ({
                            name: i.title,
                            sku: String(i.productId),
                            units: i.qty,
                            selling_price: i.price,
                        }); }),
                        payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
                        sub_total: order.totalAmount,
                        length: 10, // cm — default parcel dimensions
                        breadth: 10,
                        height: 10,
                        weight: 0.5, // kg — default
                    };
                    return [4 /*yield*/, axios_1.default.post("".concat(SHIPROCKET_BASE, "/orders/create/adhoc"), orderPayload, { headers: authHeaders(token) })];
                case 2:
                    createRes = _c.sent();
                    shiprocketOrderId = createRes.data.order_id;
                    shiprocketShipmentId = createRes.data.shipment_id;
                    return [4 /*yield*/, axios_1.default.post("".concat(SHIPROCKET_BASE, "/courier/assign/awb"), { shipment_id: String(shiprocketShipmentId) }, { headers: authHeaders(token) })];
                case 3:
                    awbRes = _c.sent();
                    awbData = (_b = (_a = awbRes.data) === null || _a === void 0 ? void 0 : _a.response) === null || _b === void 0 ? void 0 : _b.data;
                    awbCode = (awbData === null || awbData === void 0 ? void 0 : awbData.awb_code) || (awbData === null || awbData === void 0 ? void 0 : awbData.awb) || '';
                    courierName = (awbData === null || awbData === void 0 ? void 0 : awbData.courier_name) || (awbData === null || awbData === void 0 ? void 0 : awbData.courier_company_id) || 'Shiprocket';
                    trackingLink = awbCode
                        ? "https://shiprocket.co/tracking/".concat(awbCode)
                        : "https://shiprocket.co/tracking/order/".concat(shiprocketOrderId);
                    return [2 /*return*/, { shiprocketOrderId: shiprocketOrderId, shiprocketShipmentId: shiprocketShipmentId, awbCode: awbCode, courierName: courierName, trackingLink: trackingLink }];
            }
        });
    });
}
// ── Cancel a Shiprocket order ─────────────────────────────────────────────────
function cancelShiprocketOrder(shiprocketOrderId) {
    return __awaiter(this, void 0, void 0, function () {
        var token, err_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, getToken()];
                case 1:
                    token = _b.sent();
                    return [4 /*yield*/, axios_1.default.post("".concat(SHIPROCKET_BASE, "/orders/cancel"), { ids: [shiprocketOrderId] }, { headers: authHeaders(token) })];
                case 2:
                    _b.sent();
                    console.log("[Shiprocket] Cancelled order ".concat(shiprocketOrderId));
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _b.sent();
                    console.error('[Shiprocket] Failed to cancel order:', ((_a = err_1 === null || err_1 === void 0 ? void 0 : err_1.response) === null || _a === void 0 ? void 0 : _a.data) || err_1.message);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
