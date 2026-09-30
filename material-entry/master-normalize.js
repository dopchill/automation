const XLSX = require("xlsx");
const path = require("path");

const FILE = path.join(
    __dirname,
    "data",
    "MASTER_PRODUCT_LIST.xlsx"
);

function clean(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .trim()
        .replace(/\s+/g, " ");
}

function normalizeMaster() {

    const workbook = XLSX.readFile(FILE);

    const products = [];

    // ============================================
    // SHEET 1
    // Sheet1 has NO proper header row.
    // Every row is treated as product data.
    // ============================================

    if (workbook.Sheets["Sheet1"]) {

        const sheet1 = workbook.Sheets["Sheet1"];

        const rows = XLSX.utils.sheet_to_json(sheet1, {
            header: 1,
            defval: ""
        });

        rows.forEach((row, index) => {

            if (!row || row.length === 0) {
                return;
            }

            const productName = clean(row[0]);
            const capacity = clean(row[1]);
            const remark = clean(row[2]);
            const category = clean(row[3]);
            const brand = clean(row[4]);

            // Empty row ignore
            if (!productName && !category && !brand) {
                return;
            }

            products.push({
                sourceSheet: "Sheet1",
                sourceRow: index + 1,

                productName,
                capacity,
                remark,
                productCategory: category,
                brand
            });
        });
    }


    // ============================================
    // SHEET 2
    // Proper headers
    // ============================================

    if (workbook.Sheets["Sheet2"]) {

        const sheet2 = workbook.Sheets["Sheet2"];

        const rows = XLSX.utils.sheet_to_json(sheet2, {
            defval: ""
        });

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
                sourceSheet: "Sheet2",
                sourceRow: index + 2,

                productName,
                capacity,
                remark,
                productCategory: category,
                brand
            });
        });
    }

    return products;
}


// ============================================
// TEST
// ============================================

try {

    const products = normalizeMaster();

    console.log("\n========================================");
    console.log("NORMALIZED MASTER PRODUCT LIST");
    console.log("========================================\n");

    console.log(
        `Total normalized products: ${products.length}\n`
    );

    // First 10 products
    console.log("FIRST 10 PRODUCTS:\n");

    products.slice(0, 10).forEach((product, index) => {

        console.log(`${index + 1}. ${product.productName}`);

        console.log(
            `   Brand: ${product.brand}`
        );

        console.log(
            `   Category: ${product.productCategory}`
        );

        console.log(
            `   Capacity: ${product.capacity}`
        );

        console.log(
            `   Source: ${product.sourceSheet}!Row${product.sourceRow}`
        );

        console.log("");
    });


    // Sheet count
    const sheet1Count =
        products.filter(
            p => p.sourceSheet === "Sheet1"
        ).length;

    const sheet2Count =
        products.filter(
            p => p.sourceSheet === "Sheet2"
        ).length;

    console.log("----------------------------------------");

    console.log(
        `Sheet1 products: ${sheet1Count}`
    );

    console.log(
        `Sheet2 products: ${sheet2Count}`
    );

    console.log("----------------------------------------\n");

    console.log("MASTER NORMALIZATION COMPLETE");

} catch (error) {

    console.error("\nERROR:");
    console.error(error.message);

}