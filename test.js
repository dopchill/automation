const { chromium } = require("playwright");
const readline = require("readline");

// ==================================================
// CONFIGURATION
// ==================================================

const CHROME_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const PROFILE_PATH =
  "C:\\Users\\KISHAN KUMAR\\CRM-Automation\\chrome-profile";

const URL = "https://workplacemanager.in/";

// ==================================================
// GLOBAL VARIABLES
// ==================================================

let context;
let page;

// ==================================================
// SLEEP
// ==================================================

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================================================
// WAIT FOR START COMMAND
// ==================================================

function waitForStart() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const listener = (line) => {
      const command = line.trim().toUpperCase();

      if (command === "START") {
        rl.close();
        resolve();
      }
    };

    rl.on("line", listener);
  });
}

// ==================================================
// GET VISIBLE SELECTS
// ==================================================

async function getSelects() {
  return page.locator("select:visible");
}

// ==================================================
// SELECT OPTION EXACTLY
// ==================================================

async function selectByOption(select, optionText) {
  try {
    const options = await select.locator("option").allTextContents();

    const match = options.find(
      (x) =>
        x.trim().toLowerCase() === optionText.trim().toLowerCase()
    );

    if (!match) {
      return false;
    }

    await select.selectOption({
      label: match.trim(),
    });

    return true;
  } catch {
    return false;
  }
}

// ==================================================
// SELECT OPTION CONTAINING TEXT
// ==================================================

async function selectContaining(select, text) {
  try {
    const options = await select.locator("option").allTextContents();

    const match = options.find((x) =>
      x.trim().toLowerCase().includes(text.toLowerCase())
    );

    if (!match) {
      return false;
    }

    await select.selectOption({
      label: match.trim(),
    });

    return true;
  } catch {
    return false;
  }
}

// ==================================================
// FIND SELECT BY LABEL
// ==================================================

async function findSelectByLabel(labelText) {
  try {
    const labels = page.locator("label:visible");

    const labelCount = await labels.count();

    for (let i = 0; i < labelCount; i++) {
      const label = labels.nth(i);

      const text = (
        await label.innerText()
      )
        .trim()
        .toLowerCase();

      if (text.includes(labelText.toLowerCase())) {
        const forId = await label.getAttribute("for");

        if (forId) {
          const select = page.locator(`#${forId}`);

          if (await select.count()) {
            return select;
          }
        }

        const nearbySelect = label.locator(
          "xpath=following::select[1]"
        );

        if (await nearbySelect.count()) {
          return nearbySelect;
        }
      }
    }
  } catch {
    // Ignore and continue with fallback
  }

  return null;
}

// ==================================================
// OPEN WORKPLACE MANAGER
// ==================================================

async function openWorkplaceManager() {
  console.log("");
  console.log("==============================================");
  console.log("WORKPLACE MANAGER AUTOMATION");
  console.log("==============================================");

  console.log("");
  console.log("Opening Workplace Manager...");

  await page.goto(URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  console.log("");
  console.log("==============================================");
  console.log("MANUAL LOGIN REQUIRED");
  console.log("==============================================");

  console.log(
    "Please login manually in the Chrome browser."
  );

  console.log("");
  console.log("After login, type:");
  console.log("");
  console.log("START");
  console.log("");

  await waitForStart();

  console.log("");
  console.log("START received.");
}

// ==================================================
// OPEN APPROVE MEETING
// ==================================================

async function openApproveMeeting() {
  console.log("");
  console.log("STEP 1: Opening Approve Meeting...");

  const selects = page.locator("select:visible");

  const count = await selects.count();

  let opened = false;

  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);

    const option = select.locator(
      'option[value="../meetingList_NewClient.aspx"]'
    );

    if (await option.count()) {
      await select.selectOption({
        value: "../meetingList_NewClient.aspx",
      });

      opened = true;
      break;
    }
  }

  if (!opened) {
    throw new Error(
      "Approve Meeting option was not found."
    );
  }

  await sleep(3000);

  console.log("Approve Meeting opened.");
}

// ==================================================
// MEETING STATUS
// ==================================================

async function setMeetingStatus() {
  console.log("");
  console.log("STEP 2: Meeting Status = Success");

  const selects = await getSelects();

  const count = await selects.count();

  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);

    if (await selectByOption(select, "Success")) {
      console.log(
        "Meeting Status successfully set to Success."
      );

      return;
    }
  }

  throw new Error(
    "Meeting Status dropdown containing Success was not found."
  );
}

// ==================================================
// BRANCH
// ==================================================

async function setBranch() {
  console.log("");
  console.log("STEP 3: Branch = All");

  // First try label
  const labelSelect = await findSelectByLabel("Branch");

  if (
    labelSelect &&
    (await selectByOption(labelSelect, "All"))
  ) {
    console.log("Branch successfully set to All.");
    return;
  }

  // Fallback
  const selects = await getSelects();

  const count = await selects.count();

  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);

    const options = await select
      .locator("option")
      .allTextContents();

    const hasAll = options.some(
      (x) =>
        x.trim().toLowerCase() === "all"
    );

    if (hasAll) {
      await select.selectOption({
        label: "All",
      });

      console.log("Branch successfully set to All.");
      return;
    }
  }

  throw new Error(
    "Branch dropdown was not found."
  );
}

// ==================================================
// EMPLOYEE
// ==================================================

async function setEmployee() {
  console.log("");
  console.log(
    "STEP 4: Employee = Vicky Kumar (UR00223)"
  );

  const selects = await getSelects();

  const count = await selects.count();

  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);

    const options = await select
      .locator("option")
      .allTextContents();

    const employeeOption = options.find(
      (x) =>
        x
          .toLowerCase()
          .includes("vicky kumar") ||
        x
          .toLowerCase()
          .includes("ur00223")
    );

    if (employeeOption) {
      await select.selectOption({
        label: employeeOption.trim(),
      });

      console.log(
        `Employee selected: ${employeeOption.trim()}`
      );

      return;
    }
  }

  throw new Error(
    "Vicky Kumar / UR00223 was not found."
  );
}

// ==================================================
// MEETING TYPE
// ==================================================

async function setMeetingType() {
  console.log("");
  console.log("STEP 5: Meeting Type = All");

  // Try label first
  const labelSelect =
    await findSelectByLabel("Meeting Type");

  if (
    labelSelect &&
    (await selectByOption(labelSelect, "All"))
  ) {
    console.log(
      "Meeting Type successfully set to All."
    );

    return;
  }

  // Fallback
  const selects = await getSelects();

  const count = await selects.count();

  let allDropdowns = [];

  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);

    const options = await select
      .locator("option")
      .allTextContents();

    const hasAll = options.some(
      (x) =>
        x.trim().toLowerCase() === "all"
    );

    if (hasAll) {
      allDropdowns.push(select);
    }
  }

  if (allDropdowns.length >= 2) {
    await allDropdowns[1].selectOption({
      label: "All",
    });

    console.log(
      "Meeting Type successfully set to All."
    );

    return;
  }

  throw new Error(
    "Meeting Type dropdown was not found."
  );
}

// ==================================================
// MANUAL CALENDAR STEP
// ==================================================

async function manualCalendarStep() {
  console.log("");
  console.log("==============================================");
  console.log("MANUAL CALENDAR STEP");
  console.log("==============================================");

  console.log("");
  console.log(
    "Please manually select the following dates:"
  );

  console.log("");
  console.log("From Date  = 10/09/2026");
  console.log("Till Date  = 19/09/2026");

  console.log("");
  console.log(
    "Do NOT click Filter Grid Data manually."
  );

  console.log(
    "Do NOT change the other dropdowns."
  );

  console.log("");
  console.log(
    "After selecting BOTH dates, come back to CMD."
  );

  console.log("");
  console.log("Type:");
  console.log("");
  console.log("START");
  console.log("");

  await waitForStart();

  console.log("");
  console.log("Second START received.");
  console.log(
    "Continuing automation from Verify Status..."
  );

  await sleep(1000);
}

// ==================================================
// VERIFY STATUS
// ==================================================

async function setVerifyStatus() {
  console.log("");
  console.log("STEP 6: Verify Status = NO");

  // Try label
  const labelSelect =
    await findSelectByLabel("Verify Status");

  if (
    labelSelect &&
    (await selectByOption(labelSelect, "NO"))
  ) {
    console.log(
      "Verify Status successfully set to NO."
    );

    return;
  }

  // Fallback
  const selects = await getSelects();

  const count = await selects.count();

  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);

    const options = await select
      .locator("option")
      .allTextContents();

    const hasYes = options.some(
      (x) =>
        x.trim().toLowerCase() === "yes"
    );

    const hasNo = options.some(
      (x) =>
        x.trim().toLowerCase() === "no"
    );

    if (hasYes && hasNo) {
      await select.selectOption({
        label: "NO",
      });

      console.log(
        "Verify Status successfully set to NO."
      );

      return;
    }
  }

  throw new Error(
    "Verify Status dropdown was not found."
  );
}

// ==================================================
// FILTER GRID DATA
// ==================================================

async function filterGrid() {
  console.log("");
  console.log("STEP 7: Filter Grid Data");

  const filterButton = page.locator(
    "#mainContent_btnFilterGrid"
  );

  await filterButton.waitFor({
    state: "visible",
    timeout: 15000,
  });

  await filterButton.click();

  console.log(
    "Filter Grid Data clicked."
  );

  console.log(
    "Waiting for meeting data..."
  );

  await sleep(4000);

  console.log(
    "Checking grid..."
  );
}

// ==================================================
// WAIT FOR GRID ROWS
// ==================================================

async function waitForGridRows() {
  console.log("");
  console.log(
    "Waiting for meeting rows..."
  );

  const timeout = 15000;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Primary jqGrid row selector
    let rows = page.locator(
      "tr.jqgrow:visible"
    );

    let count = await rows.count();

    if (count > 0) {
      console.log(
        `Meeting rows found: ${count}`
      );

      return rows;
    }

    // Fallback
    rows = page.locator(
      'tr[class*="jqgrow"]:visible'
    );

    count = await rows.count();

    if (count > 0) {
      console.log(
        `Meeting rows found: ${count}`
      );

      return rows;
    }

    await sleep(500);
  }

  throw new Error(
    "Grid data is visible, but no meeting rows were detected."
  );
}

// ==================================================
// SELECT ONE MEETING
// ==================================================

async function selectOneMeeting() {
  console.log("");
  console.log(
    "STEP 8: Selecting one meeting..."
  );

  const rows = await waitForGridRows();

  const count = await rows.count();

  console.log(
    `Total meeting rows detected: ${count}`
  );

  if (count === 0) {
    throw new Error(
      "No meeting rows found."
    );
  }

  // Select first meeting
  const firstRow = rows.first();

  await firstRow.scrollIntoViewIfNeeded();

  console.log(
    "Clicking first meeting row..."
  );

  await firstRow.click();

  await sleep(1000);

  console.log(
    "First meeting row selected."
  );
}

// ==================================================
// VERIFY MEETING
// ==================================================

async function verifyMeeting() {
  console.log("");
  console.log(
    "STEP 9: Verify Meeting"
  );

  const verifyButton = page.locator(
    "#mainContent_btnModify"
  );

  await verifyButton.waitFor({
    state: "visible",
    timeout: 15000,
  });

  await verifyButton.click();

  console.log("");
  console.log("==============================================");
  console.log("VERIFY MEETING CLICKED");
  console.log("==============================================");

  console.log("");
  console.log(
    "AUTOMATION COMPLETED."
  );

  console.log(
    "Browser will remain open."
  );

  console.log("");
}

// ==================================================
// MAIN AUTOMATION
// ==================================================

async function main() {
  try {
    // ----------------------------------------------
    // LAUNCH CHROME
    // ----------------------------------------------

    context =
      await chromium.launchPersistentContext(
        PROFILE_PATH,
        {
          headless: false,

          executablePath:
            CHROME_PATH,

          viewport: null,

          args: [
            "--start-maximized",
          ],
        }
      );

    // ----------------------------------------------
    // GET EXISTING PAGE OR CREATE NEW
    // ----------------------------------------------

    page =
      context.pages()[0] ||
      await context.newPage();

    // ----------------------------------------------
    // OPEN WEBSITE + FIRST START
    // ----------------------------------------------

    await openWorkplaceManager();

    // ----------------------------------------------
    // APPROVE MEETING
    // ----------------------------------------------

    await openApproveMeeting();

    // ----------------------------------------------
    // FILTER SETTINGS
    // ----------------------------------------------

    await setMeetingStatus();

    await setBranch();

    await setEmployee();

    await setMeetingType();

    // ----------------------------------------------
    // MANUAL DATE SELECTION
    // ----------------------------------------------

    await manualCalendarStep();

    // ----------------------------------------------
    // CONTINUE AFTER SECOND START
    // ----------------------------------------------

    await setVerifyStatus();

    // ----------------------------------------------
    // FILTER
    // ----------------------------------------------

    await filterGrid();

    // ----------------------------------------------
    // SELECT ONE ROW
    // ----------------------------------------------

    await selectOneMeeting();

    // ----------------------------------------------
    // VERIFY MEETING
    // ----------------------------------------------

    await verifyMeeting();

    // ----------------------------------------------
    // KEEP BROWSER OPEN
    // ----------------------------------------------

    await new Promise(() => {});
  } catch (error) {
    console.log("");
    console.log("==============================================");
    console.log("AUTOMATION ERROR");
    console.log("==============================================");

    console.log("");
    console.log(error.message);

    console.log("");
    console.log(
      "Browser will remain open for inspection."
    );

    console.log("");

    // Keep browser open
    await new Promise(() => {});
  }
}

// ==================================================
// START
// ==================================================

main();