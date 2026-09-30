const XLSX = require("xlsx");
const path = require("path");

const FILE = path.join(
    __dirname,
    "data",
    "MASTER_PRODUCT_LIST.xlsx"
);

try {
    const workbook = XLSX.readFile(FILE);

    console.log("\n========================================");
    console.log("MASTER PRODUCT LIST CHECK");
    console.log("========================================\n");

    console.log("File:", FILE);

    console.log("\nSheets found:");

    workbook.SheetNames.forEach((sheetName, index) => {

        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(sheet, {
            defval: ""
        });

        console.log(`\n${index + 1}. Sheet: ${sheetName}`);
        console.log(`   Rows: ${rows.length}`);

        if (rows.length > 0) {

            console.log("   Columns:");

            console.log(
                "   " + Object.keys(rows[0]).join(" | ")
            );

            console.log("\n   First row:");

            console.log(rows[0]);

        } else {

            console.log("   Empty sheet");

        }
    });

    console.log("\n========================================");
    console.log("MASTER CHECK COMPLETE");
    console.log("========================================\n");

} catch (error) {

    console.error("\nERROR:");
    console.error(error.message);

}