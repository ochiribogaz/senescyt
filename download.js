import puppeteer from "puppeteer";
import cliProgress from "cli-progress";
import { downloadSenescytCertificationById } from "./retrieveSenescytData.js";
import people from "./data.json" assert { type: "json" };


(async () => {
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

    let browser;
    try {
        bar.start(people.length, 0);

        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ],
        });

        let progress = 0;

        for (let person of people) {

            const {
                number,
                name,
                id: unformmattedId,
            } = person;

            const id = unformmattedId.length === 10 ?
                unformmattedId :
                "0" + unformmattedId;

            let success = false;

            while (!success) {
                success = await downloadSenescytCertificationById({
                    id,
                    browser,
                })
            }

            progress++;
            bar.update(progress);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

    } catch (error) {
        console.error(error);
    } finally {
        await browser?.close();
        bar.stop();
    }
})();