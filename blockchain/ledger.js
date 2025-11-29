const crypto = require("crypto");

exports.recordEvent = (type, data) => {
    const eventHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");

    console.log("Blockchain Event:", type, "Hash:", eventHash);
};
