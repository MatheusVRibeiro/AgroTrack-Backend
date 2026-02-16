"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = void 0;
const generateId = (prefix) => {
    const rand = Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, '0');
    const base = `${Date.now()}${rand}`;
    return prefix ? `${prefix}-${base}` : base;
};
exports.generateId = generateId;
//# sourceMappingURL=id.js.map