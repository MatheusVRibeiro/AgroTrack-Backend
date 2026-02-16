"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUpdate = void 0;
const buildUpdate = (data, allowedFields) => {
    const fields = [];
    const values = [];
    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(data[field]);
        }
    }
    return { fields, values };
};
exports.buildUpdate = buildUpdate;
//# sourceMappingURL=sql.js.map