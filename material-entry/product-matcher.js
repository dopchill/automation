const XLSX = require("xlsx");
const path = require("path");

const DAY1_FILE = path.join(
    __dirname,
    "data",
    "DAY_1_ENTRY.xlsx"
);

const MASTER_FILE = path.join(
    __dirname,
    "data",
    "MASTER_PRODUCT_LIST.xlsx"
);


// ============================================
// BASIC HELPERS
// ============================================

function clean(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .trim()
        .replace(/\s+/g, " ");
}


function normalizeText(value) {
    return clean(value)
        .toLowerCase()
        .replace(/["'`]/g, "")
        .replace(/[(){}\[\],.:;/_\\#-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function compactText(value) {
    return normalizeText(value)
        .replace(/\s/g, "");
}


// ============================================
// EXTRACT MODEL-LIKE CODES
// ============================================

function extractCodes(text) {

    const value = clean(text).toUpperCase();

    const matches = value.match(
        /[A-Z]{1,8}[-]?[A-Z0-9]{2,20}/g
    );

    if (!matches) {
        return [];
    }

    return [...new Set(
        matches.map(x =>
            x.replace(/[^A-Z0-9]/g, "")
        )
    )];
}


// ============================================
// LOAD MASTER
// ============================================

function loadMaster() {

    const workbook = XLSX.readFile(MASTER_FILE);

    const products = [];


    // -----------------------------
    // SHEET 1
    // No header
    // -----------------------------

    if (workbook.Sheets["Sheet1"]) {

        const rows = XLSX.utils.sheet_to_json(
            workbook.Sheets["Sheet1"],
            {
                header: 1,
                defval: ""
            }
        );

        rows.forEach((row, index) => {

            if (!row || row.length === 0) {
                return;
            }

            const productName = clean(row[0]);
            const capacity = clean(row[1]);
            const remark = clean(row[2]);
            const category = clean(row[3]);
            const brand = clean(row[4]);

            if (!productName && !category && !brand) {
                return;
            }

            products.push({
                productName,
                capacity,
                remark,
                productCategory: category,
                brand,
                sourceSheet: "Sheet1",
                sourceRow: index + 1
            });
        });
    }


    // -----------------------------
    // SHEET 2
    // Proper headers
    // -----------------------------

    if (workbook.Sheets["Sheet2"]) {

        const rows = XLSX.utils.sheet_to_json(
            workbook.Sheets["Sheet2"],
            {
                defval: ""
            }
        );

        rows.forEach((row, index) => {

            const productName =
                clean(row["Product Name"]);

            const capacity =
                clean(row["Capacity"]);

            const remark =
                clean(row["Remark"]);

            const category =
                clean(row["Product Category"]);

            const brand =
                clean(row["Brand"]);

            if (!productName && !category && !brand) {
                return;
            }

            products.push({
                productName,
                capacity,
                remark,
                productCategory: category,
                brand,
                sourceSheet: "Sheet2",
                sourceRow: index + 2
            });
        });
    }

    return products;
}


// ============================================
// LOAD DAY 1 ENTRY
// ============================================

function loadDay1() {

    const workbook = XLSX.readFile(DAY1_FILE);

    const entries = [];

    for (const sheetName of workbook.SheetNames) {

        if (sheetName.toLowerCase() === "summary") {
            continue;
        }

        const rows = XLSX.utils.sheet_to_json(
            workbook.Sheets[sheetName],
            {
                defval: ""
            }
        );

        rows.forEach((row, index) => {

            entries.push({
                sheetName,
                rowNumber: index + 2,

                partyName:
                    clean(row["Party Name"]),

                brand:
                    clean(row["Brand"]),

                productCategory:
                    clean(row["Product Category"]),

                capacity:
                    clean(row["Capacity"]),

                productName:
                    clean(row["Product Name"]),

                modelNumber:
                    clean(row["Model Number"]),

                quantity:
                    Number(row["Quantity"] || 0),

                matchStatus:
                    clean(row["Match Status"]),

                matchConfidence:
                    clean(row["Match Confidence"])
            });
        });
    }

    return entries;
}


// ============================================
// CAPACITY NORMALIZATION
// ============================================

function normalizeCapacity(value) {

    let text = normalizeText(value);

    text = text
        .replace(/(\d+)\s*gb/g, "$1gb")
        .replace(/(\d+)\s*tb/g, "$1tb")
        .replace(/(\d+)\s*mb/g, "$1mb");

    return text;
}


// ============================================
// SCORE ONE MASTER PRODUCT
// ============================================

function scoreProduct(entry, master) {

    let score = 0;

    const entryBrand =
        normalizeText(entry.brand);

    const masterBrand =
        normalizeText(master.brand);

    const entryCategory =
        normalizeText(entry.productCategory);

    const masterCategory =
        normalizeText(master.productCategory);

    const entryCapacity =
        normalizeCapacity(entry.capacity);

    const masterCapacity =
        normalizeCapacity(master.capacity);

    const entryProduct =
        normalizeText(entry.productName);

    const masterProduct =
        normalizeText(master.productName);

    const entryModel =
        compactText(entry.modelNumber);

    const masterProductCompact =
        compactText(master.productName);


    // -----------------------------
    // BRAND
    // -----------------------------

    if (
        entryBrand &&
        masterBrand &&
        entryBrand === masterBrand
    ) {
        score += 30;
    }


    // -----------------------------
    // CATEGORY
    // -----------------------------

    if (
        entryCategory &&
        masterCategory &&
        entryCategory === masterCategory
    ) {
        score += 20;
    }


    // -----------------------------
    // CAPACITY
    // -----------------------------

    if (
        entryCapacity &&
        masterCapacity &&
        entryCapacity === masterCapacity
    ) {
        score += 20;
    }


    // -----------------------------
    // EXACT PRODUCT NAME
    // -----------------------------

    if (
        entryProduct &&
        masterProduct &&
        entryProduct === masterProduct
    ) {
        score += 40;
    }


    // -----------------------------
    // MODEL NUMBER
    // -----------------------------

    if (entryModel) {

        const model =
            entryModel;

        if (
            masterProductCompact.includes(model)
        ) {
            score += 50;
        }
    }


    // -----------------------------
    // PRODUCT NAME TOKEN MATCH
    // -----------------------------

    const entryTokens =
        new Set(
            entryProduct
                .split(" ")
                .filter(x => x.length >= 2)
        );

    const masterTokens =
        new Set(
            masterProduct
                .split(" ")
                .filter(x => x.length >= 2)
        );

    let commonTokens = 0;

    for (const token of entryTokens) {

        if (masterTokens.has(token)) {
            commonTokens++;
        }
    }

    if (entryTokens.size > 0) {

        const tokenRatio =
            commonTokens / entryTokens.size;

        score += Math.round(tokenRatio * 25);
    }


    return score;
}


// ============================================
// FIND BEST MATCHES
// ============================================

function findMatches(entry, masterProducts) {

    const results = masterProducts.map(master => {

        return {
            master,
            score: scoreProduct(entry, master)
        };

    });

    results.sort(
        (a, b) => b.score - a.score
    );

    return results.slice(0, 3);
}


// ============================================
// STATUS
// ============================================

function getStatus(best, secondBest) {

    if (!best) {
        return {
            status: "UNMATCHED",
            confidence: "LOW"
        };
    }


    // Strong match
    if (
        best.score >= 80 &&
        (best.score - (secondBest?.score || 0)) >= 10
    ) {
        return {
            status: "MATCHED",
            confidence: "HIGH"
        };
    }


    // Good but needs verification
    if (
        best.score >= 60
    ) {
        return {
            status: "REVIEW REQUIRED",
            confidence: "MEDIUM"
        };
    }


    return {
        status: "UNMATCHED",
        confidence: "LOW"
    };
}


// ============================================
// MAIN TEST
// ============================================

try {

    const masterProducts =
        loadMaster();

    const day1Entries =
        loadDay1();


    console.log("\n========================================");
    console.log("PRODUCT MATCHING TEST");
    console.log("========================================\n");

    console.log(
        `Master products: ${masterProducts.length}`
    );

    console.log(
        `Day 1 products: ${day1Entries.length}`
    );

    console.log("");


    let matched = 0;
    let review = 0;
    let unmatched = 0;


    day1Entries.forEach((entry, index) => {

        const matches =
            findMatches(entry, masterProducts);

        const best =
            matches[0];

        const second =
            matches[1];

        const result =
            getStatus(best, second);


        if (result.status === "MATCHED") {
            matched++;
        }

        else if (
            result.status === "REVIEW REQUIRED"
        ) {
            review++;
        }

        else {
            unmatched++;
        }


        console.log(
            `${index + 1}. ${entry.productName}`
        );

        console.log(
            `   Party: ${entry.partyName}`
        );

        console.log(
            `   Excel Status: ${entry.matchStatus}`
        );

        console.log(
            `   Result: ${result.status} (${result.confidence})`
        );


        if (best) {

            console.log(
                `   Best Master: ${best.master.productName}`
            );

            console.log(
                `   Score: ${best.score}`
            );

            console.log(
                `   Source: ${best.master.sourceSheet}!Row${best.master.sourceRow}`
            );
        }


        if (second) {

            console.log(
                `   2nd: ${second.master.productName}`
            );

            console.log(
                `   2nd Score: ${second.score}`
            );
        }


        console.log("");
    });


    console.log("========================================");
    console.log("MATCHING SUMMARY");
    console.log("========================================");

    console.log(
        `MATCHED: ${matched}`
    );

    console.log(
        `REVIEW REQUIRED: ${review}`
    );

    console.log(
        `UNMATCHED: ${unmatched}`
    );

    console.log("========================================\n");


} catch (error) {

    console.error("\nERROR:");
    console.error(error);

}