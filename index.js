import puppeteer from 'puppeteer';
import xlsx from "json-as-xlsx"
import { retrieveSenescytData } from './retrieveSenescytData.js';


(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ],
        });
        

        const strIds = '1720544632';
        const {
            errors,
            results: data,
            peopleSheet,
        } = await retrieveSenescytData({
            browser,
            strIds,
            retries: 1,
        })

        if (data?.length > 0) {
            console.log('Saving results')
            xlsx(
                [peopleSheet].concat(data),
                {
                    fileName: 'Senescyt Test',
                    extraLength: 3
                }
            )
        }

    } catch (error) {
        console.error(error);
    } finally {
        await browser?.close();
    }
})();