const XLSX = require("xlsx");
const path = require("path");

const FILE = path.join(__dirname, "data", "DAY_1_ENTRY.xlsx");

function readDay1Entry() {
    const workbook = XLSX.readFile(FILE);

    const parties = [];

    for (const sheetName of workbook.SheetNames) {

        // Summary sheet ko ignore karo
        if (sheetName.toLowerCase() === "summary") {
            continue;
        }

        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(sheet, {
            defval: ""
        });

        if (!rows.length) {
            continue;
        }

        const partyName =
            rows[0]["Party Name"] ||
            sheetName;

        const party = {
            sheetName,
            partyName,
            city: rows[0]["City"] || "",
            state: rows[0]["State"] || "",
            challanNumber: rows[0]["Challan Number"] || "",
            challanDate: rows[0]["Challan Date"] || "",
            products: []
        };

        for (const row of rows) {

            const product = {
                brand: String(row["Brand"] || "").trim(),

                productCategory:
                    String(row["Product Category"] || "").trim(),

                capacity:
                    String(row["Capacity"] || "").trim(),

                productName:
                    String(row["Product Name"] || "").trim(),

                modelNumber:
                    String(row["Model Number"] || "").trim(),

                quantity:
                    Number(row["Quantity"] || 0),

                outOfWarrantyQty:
                    Number(row["Out of Warranty Qty"] || 0),

                originalDescription:
                    String(
                        row["Original Challan Description"] || ""
                    ).trim(),

                matchStatus:
                    String(row["Match Status"] || "").trim(),

                matchConfidence:
                    String(row["Match Confidence"] || "").trim(),

                masterMatch:
                    String(row["Master Match"] || "").trim(),

                sourceFile:
                    String(row["Source File"] || "").trim(),

                remarks:
                    String(row["Remarks"] || "").trim()
            };

            party.products.push(product);
        }

        parties.push(party);
    }

    return parties;
}


// Test
try {

    const parties = readDay1Entry();

    console.log("\n========================================");
    console.log("AUTOMATION DATA CHECK");
    console.log("========================================\n");

    console.log(`Total parties: ${parties.length}\n`);

    parties.forEach((party, partyIndex) => {

        console.log(
            `${partyIndex + 1}. ${party.partyName}`
        );

        console.log(
            `   Sheet: ${party.sheetName}`
        );

        console.log(
            `   City: ${party.city}`
        );

        console.log(
            `   State: ${party.state}`
        );

        console.log(
            `   Challan: ${party.challanNumber}`
        );

        console.log(
            `   Products: ${party.products.length}`
        );

        party.products.forEach((product, productIndex) => {

            console.log(
                `      ${productIndex + 1}. ` +
                `${product.productName} | ` +
                `Qty: ${product.quantity} | ` +
                `O/W: ${product.outOfWarrantyQty}`
            );

        });

        console.log("");
    });

    console.log("========================================");
    console.log("DATA CHECK COMPLETE");
    console.log("========================================\n");

} catch (error) {

    console.error("\nERROR:");
    console.error(error);

}